import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'

function consultationApiPlugin(): Plugin {
  return {
    name: 'consultation-api',
    configureServer(server) {
      server.middlewares.use('/api/consultation', async (req: IncomingMessage, res: ServerResponse) => {
        res.setHeader('Content-Type', 'application/json')

        if (req.method !== 'POST') {
          res.writeHead(405).end(JSON.stringify({ error: 'Method not allowed' }))
          return
        }

        // Collect request body
        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        req.on('end', async () => {
          try {
            const openaiKey = process.env.OPENAI_API_KEY
            if (!openaiKey) {
              res.writeHead(500).end(JSON.stringify({ error: 'OPENAI_API_KEY is not set in .env' }))
              return
            }

            const { petType, petAge, symptoms } = JSON.parse(body)
            const normalizedPetType = typeof petType === 'string' ? petType.trim().toLowerCase() : ''
            const normalizedSymptoms = typeof symptoms === 'string' ? symptoms.trim() : ''
            const petAgeNumber = Number(petAge)

            if (!normalizedPetType || !normalizedSymptoms || Number.isNaN(petAgeNumber) || petAgeNumber < 0) {
              res.writeHead(400).end(JSON.stringify({ error: 'Missing or invalid required fields.' }))
              return
            }

            if (!['dog', 'cat'].includes(normalizedPetType)) {
              res.writeHead(400).end(JSON.stringify({ error: 'Only dog and cat consultations are supported.' }))
              return
            }

            // Dynamic import so Vite resolves it at runtime in Node context
            const { default: OpenAI } = await import('openai')
            const openai = new OpenAI({ apiKey: openaiKey })

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
            })

            const content = completion.choices[0]?.message?.content ?? ''
            const jsonText = content.trim().startsWith('```')
              ? content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
              : content.trim()

            const analysis = JSON.parse(jsonText)
            res.writeHead(200).end(JSON.stringify(analysis))
          } catch (err: any) {
            console.error('[consultation-api]', err)
            res.writeHead(500).end(JSON.stringify({ error: err.message || 'Failed to analyze pet health.' }))
          }
        })
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // Load env so OPENAI_API_KEY is available in process.env inside the plugin
  const env = loadEnv(mode, process.cwd(), '')
  Object.assign(process.env, env)

  return {
    plugins: [
      vue(),
      tailwindcss(),
      consultationApiPlugin(),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5173,
    },
  }
})

