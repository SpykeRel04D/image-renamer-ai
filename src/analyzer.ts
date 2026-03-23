import { GoogleGenAI } from '@google/genai';
import fs from 'node:fs';
import type { Config, AnalysisResult } from './types.js';

function buildPrompt(language: string, context: string): string {
  return `Eres un experto en SEO para ${context}. Analiza esta imagen y genera un nombre de archivo descriptivo en ${language}.

Reglas:
- Usa ${language}
- Máximo 6-8 palabras descriptivas
- Incluye: tipo de elemento, color, material si es visible, característica principal
- Formato: palabras separadas por guiones, todo en minúsculas
- Sin artículos (el, la, los, las, un, una, the, a, an)
- Sin caracteres especiales ni tildes (usa "a" en vez de "á", "n" en vez de "ñ")
- Ejemplo: "silla-oficina-ergonomica-malla-negra"

Responde ÚNICAMENTE con el nombre del archivo, sin extensión, sin explicación, sin comillas.`;
}

let ai: InstanceType<typeof GoogleGenAI> | null = null;

function getClient(config: Config): InstanceType<typeof GoogleGenAI> {
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return ai;
}

export async function analyzeImage(
  absolutePath: string,
  mimeType: string,
  config: Config,
): Promise<AnalysisResult> {
  const client = getClient(config);
  const imageData = fs.readFileSync(absolutePath).toString('base64');

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.models.generateContent({
        model: config.geminiModel,
        contents: [
          {
            parts: [
              { text: buildPrompt(config.language, config.context) },
              { inlineData: { data: imageData, mimeType } },
            ],
            role: 'user',
          },
        ],
      });

      const text = response.text?.trim();
      if (!text) throw new Error('Empty response from Gemini');

      const usage = response.usageMetadata;
      return {
        description: text,
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
      };
    } catch (err) {
      lastError = err as Error;
      const message = lastError.message || '';

      // Rate limit: exponential backoff
      if (message.includes('429') || message.toLowerCase().includes('rate')) {
        const wait = Math.pow(2, attempt + 1) * 1000;
        if (config.verbose) {
          console.log(`  Rate limited, waiting ${wait / 1000}s...`);
        }
        await new Promise(resolve => setTimeout(resolve, wait));
        continue;
      }

      // Other errors: short retry
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
    }
  }

  throw lastError || new Error('Failed to analyze image after 3 attempts');
}
