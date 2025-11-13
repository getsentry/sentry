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
});
