import * as Sentry from '@sentry/react';

import {getHighlightedSpanAttributes} from './highlightedAttributes';

// Mock Sentry
jest.mock('@sentry/react', () => ({
  captureMessage: jest.fn(),
}));

describe('getHighlightedSpanAttributes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should emit Sentry error when gen_ai span has model but no cost', () => {
    const attributes = {
      'gen_ai.request.model': 'gpt-4',
      'gen_ai.cost.total_tokens': '0',
      'gen_ai.usage.input_tokens': '100',
      'gen_ai.operation.type': 'ai_client',
    };

    getHighlightedSpanAttributes({
      spanId: '123',
      attributes,
    });

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Gen AI span missing cost calculation',
      {
        level: 'warning',
        tags: {
          feature: 'agent-monitoring',
          span_type: 'gen_ai',
          has_model: 'true',
          has_cost: 'false',
          model: 'gpt-4',
        },
        extra: {
          total_costs: '0',
          attributes,
        },
      }
    );
  });

  it('should not emit Sentry error when gen_ai span has model and cost', () => {
    const attributes = {
      'gen_ai.request.model': 'gpt-4',
      'gen_ai.cost.total_tokens': '0.05',
      'gen_ai.operation.type': 'ai_client',
    };

    getHighlightedSpanAttributes({
      spanId: '123',
      attributes,
    });

    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('should not emit Sentry error when gen_ai span has no model', () => {
    const attributes = {
      'gen_ai.cost.total_tokens': '0',
      'gen_ai.operation.type': 'ai_client',
    };

    getHighlightedSpanAttributes({
      spanId: '123',
      attributes,
    });

    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('should not emit Sentry error for non-gen_ai spans', () => {
    const attributes = {
      'gen_ai.request.model': 'gpt-4',
      'gen_ai.cost.total_tokens': '0',
    };

    getHighlightedSpanAttributes({
      spanId: '123',
      attributes,
    });

    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('should emit Sentry error when gen_ai span with auto.ai origin is missing required attributes', () => {
    const attributes = {
      'gen_ai.origin': 'auto.ai.openai',
      'gen_ai.request.model': 'gpt-4',
      'gen_ai.cost.total_tokens': '0.05',
      'sdk.name': 'sentry.python',
      'sdk.version': '2.0.0',
      'gen_ai.operation.type': 'ai_client',
      // Missing: gen_ai.system, gen_ai.operation.name, gen_ai.agent.name
    };

    getHighlightedSpanAttributes({
      spanId: '123',
      attributes,
    });

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Gen AI span missing required attributes',
      {
        level: 'warning',
        tags: {
          feature: 'agent-monitoring',
          span_type: 'gen_ai',
          missing_attributes: 'gen_ai.system,gen_ai.operation.name,gen_ai.agent.name',
          origin: 'auto.ai.openai',
          sdk: 'sentry.python@2.0.0',
          span_id: '123',
        },
      }
    );
  });

  it('should not emit Sentry error when gen_ai span has all required attributes', () => {
    const attributes = {
      'gen_ai.origin': 'auto.ai.openai',
      'gen_ai.system': 'openai',
      'gen_ai.request.model': 'gpt-4',
      'gen_ai.cost.total_tokens': '0.05',
      'gen_ai.operation.name': 'chat',
      'gen_ai.agent.name': 'my-agent',
      'gen_ai.operation.type': 'ai_client',
    };

    getHighlightedSpanAttributes({
      spanId: '123',
      attributes,
    });

    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('should not emit Sentry error when origin does not start with auto.ai', () => {
    const attributes = {
      'gen_ai.origin': 'manual.openai',
      // Missing required attributes
    };

    getHighlightedSpanAttributes({
      spanId: '123',
      attributes,
    });

    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('should not emit Sentry error when origin is not defined', () => {
    const attributes = {
      // Missing required attributes and no origin
    };

    getHighlightedSpanAttributes({
      spanId: '123',
      attributes,
    });

    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('should use unknown for sdk when not provided', () => {
    const attributes = {
      'gen_ai.origin': 'auto.ai.openai',
      'gen_ai.operation.type': 'ai_client',
      // No sdk.name or sdk.version
    };

    getHighlightedSpanAttributes({
      spanId: '456',
      attributes,
    });

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Gen AI span missing required attributes',
      {
        level: 'warning',
        tags: {
          feature: 'agent-monitoring',
          span_type: 'gen_ai',
          missing_attributes:
            'gen_ai.system,gen_ai.request.model,gen_ai.operation.name,gen_ai.agent.name',
          origin: 'auto.ai.openai',
          sdk: 'unknown',
          span_id: '456',
        },
      }
    );
  });
});
