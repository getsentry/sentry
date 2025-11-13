import {getModelPlatform} from './modelName';

// Test suite for getModelPlatform function
describe('getModelPlatform Function', () => {
  it('returns platform for known modelId', () => {
    expect(getModelPlatform('gpt-3')).toBe('openai');
    expect(getModelPlatform('gpt-3.5')).toBe('openai');
    expect(getModelPlatform('gpt-4o')).toBe('openai');
    expect(getModelPlatform('gpt-4o-mini')).toBe('openai');
    expect(getModelPlatform('o1-mini')).toBe('openai');
    expect(getModelPlatform('o3')).toBe('openai');
    expect(getModelPlatform('o4')).toBe('openai');

    expect(getModelPlatform('gemini-2.5')).toBe('gemini');
    expect(getModelPlatform('gemma-7b')).toBe('gemini');
    expect(getModelPlatform('claude-3.5-sonnet')).toBe('anthropic-claude');
    expect(getModelPlatform('deepseek-coder')).toBe('deepseek');
    expect(getModelPlatform('grok-beta')).toBe('grok');
    expect(getModelPlatform('groq-llama')).toBe('groq');
    expect(getModelPlatform('mistral-7b')).toBe('mistral');
    expect(getModelPlatform('perplexity-sonar')).toBe('perplexity');
  });

  it('returns null for unknown modelId', () => {
    expect(getModelPlatform('unknown-model')).toBeNull();
    expect(getModelPlatform('Llama 3.1')).toBeNull();
    expect(getModelPlatform('Qwen 2.5')).toBeNull();
    expect(getModelPlatform('random-ai-model')).toBeNull();
  });

  it('returns provider when provider is explicitly provided', () => {
    expect(getModelPlatform('some-model', 'openai')).toBe('openai');
    expect(getModelPlatform('some-model', 'google')).toBe('google');
    expect(getModelPlatform('some-model', 'anthropic')).toBe('anthropic');
    expect(getModelPlatform('some-model', 'unknown-provider')).toBe('unknown-provider');
  });
});
