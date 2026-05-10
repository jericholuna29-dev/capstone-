import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import OpenAI from 'openai'

const app = express()
const PORT = 3000

app.use(cors())
app.use(express.json())

// ── helpers ──────────────────────────────────────────────────────────────────

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY in .env')
  return new OpenAI({ apiKey })
}

function parseAIResponse(raw) {
  const normalized = raw.trim()
  const jsonText = normalized.startsWith('```')
    ? normalized.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
    : normalized
  const parsed = JSON.parse(jsonText)
  if (
    !parsed ||
    !Array.isArray(parsed.possible_illnesses) ||
    !Array.isArray(parsed.tips) ||
    !Array.isArray(parsed.recommendations) ||
    !['low', 'medium', 'high'].includes(parsed.severity)
  ) {
    throw new Error('AI returned an invalid response format.')
  }
  return parsed
}

async function getAIPetHealthAnalysis(petType, petAge, symptoms) {
  const openai = getOpenAIClient()
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    max_tokens: 800,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'You are a veterinary assistant. Return strictly valid JSON with keys: possible_illnesses, tips, recommendations, severity. Severity must be one of low, medium, high.',
      },
      {
        role: 'user',
        content: `Analyze the following pet health concern and provide guidance.

Pet Type: ${petType}
Pet Age: ${petAge} years
Symptoms: ${symptoms}

Please provide a JSON response with the following structure:
{
  "possible_illnesses": ["illness1", "illness2", ...],
  "tips": ["tip1", "tip2", ...],
  "recommendations": ["recommendation1", "recommendation2", ...],
  "severity": "low|medium|high"
}

IMPORTANT: Respond ONLY with valid JSON, no additional text.`,
      },
    ],
  })
  const content = completion.choices[0]?.message?.content
  if (!content) throw new Error('OpenAI returned an empty response.')
  return parseAIResponse(content)
}

// ── routes ───────────────────────────────────────────────────────────────────

app.post('/api/consultation', async (req, res) => {
  try {
    const { petType, petAge, symptoms } = req.body

    const normalizedPetType = typeof petType === 'string' ? petType.trim().toLowerCase() : ''
    const normalizedSymptoms = typeof symptoms === 'string' ? symptoms.trim() : ''
    const petAgeNumber = Number(petAge)

    if (!normalizedPetType || !normalizedSymptoms || Number.isNaN(petAgeNumber) || petAgeNumber < 0) {
      return res.status(400).json({ error: 'Missing or invalid required fields (petType, petAge, symptoms).' })
    }

    if (!['dog', 'cat'].includes(normalizedPetType)) {
      return res.status(400).json({ error: 'Only dog and cat consultations are supported right now.' })
    }

    const analysis = await getAIPetHealthAnalysis(normalizedPetType, petAgeNumber, normalizedSymptoms)
    return res.json(analysis)
  } catch (err) {
    console.error('Consultation API error:', err)
    return res.status(500).json({ error: err.message || 'Failed to analyze pet health.' })
  }
})

app.listen(PORT, () => {
  console.log(`✅  PetWell API server running on http://localhost:${PORT}`)
})
