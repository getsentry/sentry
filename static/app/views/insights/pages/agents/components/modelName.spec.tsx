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
    expect(getModelPlatform('openai/text-embedding-3-small')).toBe('openai');
    expect(getModelPlatform('text-embedding-3-large')).toBe('openai');
    expect(getModelPlatform('text-embedding-ada-002')).toBe('openai');

    expect(getModelPlatform('gemini-2.5')).toBe('gemini');
    expect(getModelPlatform('text-embedding-005')).toBe('google');
    expect(getModelPlatform('gemma-7b')).toBe('gemini');
    expect(getModelPlatform('claude-3.5-sonnet')).toBe('anthropic-claude');
    expect(getModelPlatform('cohere/command-r-plus')).toBe('cohere');
    expect(getModelPlatform('deepseek-coder')).toBe('deepseek');
    expect(getModelPlatform('grok-beta')).toBe('grok');
    expect(getModelPlatform('groq-llama')).toBe('groq');
    expect(getModelPlatform('huggingface/meta-llama/Llama-3.1')).toBe('huggingface');
    expect(getModelPlatform('mistral-7b')).toBe('mistral');
    expect(getModelPlatform('nvidia/llama-3.1-nemotron')).toBe('nvidia');
    expect(getModelPlatform('perplexity-sonar')).toBe('perplexity');
    expect(getModelPlatform('amazon.titan-embed-text-v2:0')).toBe('amazon');
  });

  it('returns null for unknown modelId', () => {
    expect(getModelPlatform('unknown-model')).toBeNull();
    expect(getModelPlatform('Llama 3.1')).toBeNull();
    expect(getModelPlatform('Qwen 2.5')).toBeNull();
    expect(getModelPlatform('random-ai-model')).toBeNull();
  });
});
