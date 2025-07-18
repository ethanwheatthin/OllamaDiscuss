import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

// TypeScript Interfaces for Ollama API
export interface OllamaModel {
  id: string;
  object: string;
  created: number;
  owned_by: string;
}

export interface OllamaTagsResponse {
  models: OllamaModel[];
}

export interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

@Injectable({
  providedIn: 'root',
})
export class OllamaService {
  constructor() { }

  // Test the connection to the Ollama API
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetch('http://localhost:11434/api/tags');
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Fetch all locally installed models
  async getModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch('http://localhost:11434/v1/models');
      if (!response.ok) {
        // It's good practice to handle non-OK responses more specifically,
        // e.g., by throwing an error or returning an empty array as you had.
        // For now, let's stick to your original intention of returning an empty array.
        return [];
      }

      const data = await response.json(); // Parse the JSON once and await it

      // Now 'data' contains the parsed JSON object.
      // We can access properties like 'data.models' if they exist.

      console.log("🚀 ~ OllamaService ~ data:", data.data); // Log the entire data object

      // Assuming the API response structure is { models: [...] }
      return data.data || [];
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return [];
    }
  }

  // Generate a response, returning an Observable stream
  generate(
    model: string,
    prompt: string,
    context: number[]
  ): Observable<OllamaGenerateResponse> {
    return new Observable((observer) => {
      const body = {
        model,
        prompt,
        context,
        stream: true,
      };

      fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        body: JSON.stringify(body),
      })
        .then(async (response) => {
          if (!response.body) {
            throw new Error('Response body is null.');
          }
          const reader = response.body.getReader();
          const decoder = new TextDecoder();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            // Ollama streams JSON objects separated by newlines
            const jsonResponses = chunk
              .split('\n')
              .filter((line) => line.trim() !== '');

            for (const jsonResponse of jsonResponses) {
              try {
                const parsed = JSON.parse(jsonResponse);
                observer.next(parsed);
              } catch (e) {
                console.error('Failed to parse JSON chunk:', jsonResponse);
              }
            }
          }
          observer.complete();
        })
        .catch((err) => {
          observer.error(err);
        });
    });
  }
}