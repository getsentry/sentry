import * as Sentry from '@sentry/react';

import {getHighlightedSpanAttributes} from './highlightedAttributes';

// Mock Sentry
jest.mock('@sentry/react', () => ({
  captureMessage: jest.fn(),
}));

// Mock the query utility
jest.mock('sentry/views/insights/pages/agents/utils/query', () => ({
  getIsAiSpan: jest.fn(({op}) => op?.startsWith('gen_ai.')),
}));

describe('getHighlightedSpanAttributes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should emit Sentry error when gen_ai span has model but no cost', () => {
    const attributes = {
      'gen_ai.request.model': 'gpt-4',
      'gen_ai.usage.total_cost': '0',
    };

    getHighlightedSpanAttributes({
      op: 'gen_ai.chat',
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
          span_operation: 'gen_ai.chat',
          model: 'gpt-4',
        },
        extra: {
          total_costs: '0',
          span_operation: 'gen_ai.chat',
          attributes,
        },
      }
    );
  });

  it('should not emit Sentry error when gen_ai span has model and cost', () => {
    const attributes = {
      'gen_ai.request.model': 'gpt-4',
      'gen_ai.usage.total_cost': '0.05',
    };

    getHighlightedSpanAttributes({
      op: 'gen_ai.chat',
      spanId: '123',
      attributes,
    });

    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('should not emit Sentry error when gen_ai span has no model', () => {
    const attributes = {
      'gen_ai.usage.total_cost': '0',
    };

    getHighlightedSpanAttributes({
      op: 'gen_ai.chat',
      spanId: '123',
      attributes,
    });

    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('should not emit Sentry error for non-gen_ai spans', () => {
    const attributes = {
      'gen_ai.request.model': 'gpt-4',
      'gen_ai.usage.total_cost': '0',
    };

    getHighlightedSpanAttributes({
      op: 'http.request',
      spanId: '123',
      attributes,
    });

    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('should emit Sentry error when gen_ai span with auto.ai origin is missing required attributes', () => {
    const attributes = {
      'gen_ai.origin': 'auto.ai.openai',
      'gen_ai.request.model': 'gpt-4',
      'gen_ai.usage.total_cost': '0.05',
      'sdk.name': 'sentry.python',
      'sdk.version': '2.0.0',
      // Missing: gen_ai.system, gen_ai.operation.name, gen_ai.agent.name
    };

    getHighlightedSpanAttributes({
      op: 'gen_ai.chat',
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
          span_operation: 'gen_ai.chat',
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
      'gen_ai.usage.total_cost': '0.05',
      'gen_ai.operation.name': 'chat',
      'gen_ai.agent.name': 'my-agent',
    };

    getHighlightedSpanAttributes({
      op: 'gen_ai.chat',
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
      op: 'gen_ai.chat',
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
      op: 'gen_ai.chat',
      spanId: '123',
      attributes,
    });

    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  it('should use unknown for sdk when not provided', () => {
    const attributes = {
      'gen_ai.origin': 'auto.ai.openai',
      // No sdk.name or sdk.version
    };

    getHighlightedSpanAttributes({
      op: 'gen_ai.chat',
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
          span_operation: 'gen_ai.chat',
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
