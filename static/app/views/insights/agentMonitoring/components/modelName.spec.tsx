import {getModelProvider} from './modelName';

// Test suite for getModelProvider function
describe('getModelProvider Function', () => {
  it('returns provider for known modelId', () => {
    expect(getModelProvider('gpt-3')).toBe('openai');
    expect(getModelProvider('gpt-3.5')).toBe('openai');
    expect(getModelProvider('gpt-4o')).toBe('openai');
    expect(getModelProvider('gpt-4o-mini')).toBe('openai');
    expect(getModelProvider('o1-mini')).toBe('openai');
    expect(getModelProvider('o3')).toBe('openai');
    expect(getModelProvider('o4')).toBe('openai');

    expect(getModelProvider('gemini-2.5')).toBe('google');
    expect(getModelProvider('claude-3.5-sonnet')).toBe('anthropic');
  });

  it('returns null for unknown modelId', () => {
    expect(getModelProvider('DeepSeek R1')).toBeNull();
    expect(getModelProvider('Sonar')).toBeNull();
    expect(getModelProvider('Llama 3.1')).toBeNull();
    expect(getModelProvider('Qwen 2.5')).toBeNull();
    expect(getModelProvider('Mistral')).toBeNull();
  });

  it('returns provider when provider is explicitly provided', () => {
    expect(getModelProvider('some-model', 'openai')).toBe('openai');
    expect(getModelProvider('some-model', 'google')).toBe('google');
    expect(getModelProvider('some-model', 'anthropic')).toBe('anthropic');
    expect(getModelProvider('some-model', 'unknown')).toBeNull();
  });
});
