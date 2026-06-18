const MAX_FILE_BYTES = 4_000_000;
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

const FIELD_NAMES = [
  'docType', 'tenant', 'address', 'caseNumber', 'court', 'judge', 'filedDate',
  'hearingDate', 'hearingTime', 'caseType', 'amount', 'virtualPlatform',
  'meetingId', 'meetingPassword', 'joinLink', 'judgmentDate', 'judgmentType',
  'possessionJudgment', 'rentOwed', 'costs', 'judgmentTotal',
  'payOrVacateDeadline', 'furtherOrders', 'signedBy', 'evictionOrderDate',
  'evictionApplicationDate', 'evictionJudgmentDate', 'evictionPaymentReceived',
  'evictionSignedBy'
];

const nullableString = { type: ['string', 'null'] };

const extractionSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    docType: {
      type: ['string', 'null'],
      enum: ['summons', 'judgment', 'eviction', 'other', null]
    },
    tenant: nullableString,
    address: nullableString,
    caseNumber: nullableString,
    court: nullableString,
    judge: nullableString,
    filedDate: nullableString,
    hearingDate: nullableString,
    hearingTime: nullableString,
    caseType: {
      type: ['string', 'null'],
      enum: ['Eviction', 'Money Judgment', 'Land Contract', 'Trespass', 'Other', null]
    },
    amount: nullableString,
    virtualPlatform: nullableString,
    meetingId: nullableString,
    meetingPassword: nullableString,
    joinLink: nullableString,
    judgmentDate: nullableString,
    judgmentType: {
      type: ['string', 'null'],
      enum: ['Consent', 'Default', 'Hearing', null]
    },
    possessionJudgment: nullableString,
    rentOwed: nullableString,
    costs: nullableString,
    judgmentTotal: nullableString,
    payOrVacateDeadline: nullableString,
    furtherOrders: nullableString,
    signedBy: nullableString,
    evictionOrderDate: nullableString,
    evictionApplicationDate: nullableString,
    evictionJudgmentDate: nullableString,
    evictionPaymentReceived: nullableString,
    evictionSignedBy: nullableString
  },
  required: FIELD_NAMES
};

const extractionInstructions = `You extract structured data from Michigan landlord-tenant court documents for a case docket.

The document may be a summons (often DC-104), judgment (often DC-105), order of eviction (often DC-107), or another related filing. Read printed text, checkboxes, stamps, and legible handwriting carefully.

Rules:
- Return null for a field that is not present or cannot be read confidently.
- Use YYYY-MM-DD for every date.
- Use HH:MM in 24-hour time for hearingTime.
- Return numeric money fields as plain decimal strings without dollar signs or commas.
- Preserve exact wording in furtherOrders.
- Do not invent missing facts.
- For an order of eviction, evictionOrderDate is the date the judge signed the order.`;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

function responseText(response) {
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) return content.text;
      if (content.type === 'refusal') throw new Error('The document could not be processed.');
    }
  }
  return '';
}

export default {
  async fetch(request) {
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed.' }, 405);
    }

    if (!process.env.OPENAI_API_KEY) {
      return json({ error: 'OpenAI extraction is not configured yet.' }, 503);
    }

    const mimeType = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!ALLOWED_TYPES.has(mimeType)) {
      return json({ error: 'Upload a PDF, JPG, PNG, or WEBP file.' }, 415);
    }

    let filename = 'court-document';
    try {
      filename = decodeURIComponent(request.headers.get('x-file-name') || filename).slice(0, 180);
    } catch {
      filename = 'court-document';
    }

    const bytes = Buffer.from(await request.arrayBuffer());
    if (!bytes.length) return json({ error: 'The uploaded file is empty.' }, 400);
    if (bytes.length > MAX_FILE_BYTES) {
      return json({ error: 'The file is larger than 4 MB. Compress it and try again.' }, 413);
    }

    const base64 = bytes.toString('base64');
    const documentInput = mimeType === 'application/pdf'
      ? {
          type: 'input_file',
          filename,
          file_data: `data:${mimeType};base64,${base64}`
        }
      : {
          type: 'input_image',
          image_url: `data:${mimeType};base64,${base64}`,
          detail: 'high'
        };

    try {
      const openAIResponse = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-5.4-mini',
          store: false,
          input: [
            { role: 'system', content: extractionInstructions },
            {
              role: 'user',
              content: [
                documentInput,
                { type: 'input_text', text: 'Extract the docket fields from this court document.' }
              ]
            }
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'court_document_extraction',
              strict: true,
              schema: extractionSchema
            }
          }
        })
      });

      const response = await openAIResponse.json();
      if (!openAIResponse.ok) {
        const message = response?.error?.message || `OpenAI request failed (${openAIResponse.status}).`;
        return json({ error: message }, openAIResponse.status >= 500 ? 502 : 400);
      }

      const text = responseText(response);
      if (!text) return json({ error: 'OpenAI did not return extracted fields.' }, 502);

      return json({ data: JSON.parse(text) });
    } catch (error) {
      console.error('Document extraction failed', error);
      return json({ error: 'Document extraction failed. Please try again.' }, 500);
    }
  }
};
