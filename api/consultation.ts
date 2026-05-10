import { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is not set' });
    }

    const { petType, petAge, symptoms } = req.body;

    const normalizedPetType = typeof petType === 'string' ? petType.trim().toLowerCase() : '';
    const normalizedSymptoms = typeof symptoms === 'string' ? symptoms.trim() : '';
    const petAgeNumber = Number(petAge);

    if (!normalizedPetType || !normalizedSymptoms || Number.isNaN(petAgeNumber) || petAgeNumber < 0) {
      return res.status(400).json({ error: 'Missing or invalid required fields.' });
    }

    if (!['dog', 'cat'].includes(normalizedPetType)) {
      return res.status(400).json({ error: 'Only dog and cat consultations are supported.' });
    }

    const openai = new OpenAI({ apiKey: openaiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      max_tokens: 800,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a veterinary assistant. Return strictly valid JSON with keys: possible_illnesses (array), tips (array), recommendations (array), severity (one of: low, medium, high).',
        },
        {
          role: 'user',
          content: `Analyze this pet health concern and respond with ONLY valid JSON.\n\nPet Type: ${normalizedPetType}\nPet Age: ${petAgeNumber} years\nSymptoms: ${normalizedSymptoms}\n\nJSON structure:\n{\n  "possible_illnesses": ["..."],\n  "tips": ["..."],\n  "recommendations": ["..."],\n  "severity": "low|medium|high"\n}`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content ?? '';
    const jsonText = content.trim().startsWith('```')
      ? content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
      : content.trim();

    const analysis = JSON.parse(jsonText);
    return res.status(200).json(analysis);
  } catch (err: any) {
    console.error('[consultation-api]', err);
    return res.status(500).json({ error: err.message || 'Failed to analyze pet health.' });
  }
}
