import * as Sentry from '@sentry/react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {trackAnalytics} from 'sentry/utils/analytics';

import {getHighlightedSpanAttributes} from './highlightedAttributes';

// Mock Sentry
jest.mock('@sentry/react', () => ({
  captureMessage: jest.fn(),
}));

jest.mock('sentry/utils/analytics', () => ({
  trackAnalytics: jest.fn(),
}));

describe('getHighlightedSpanAttributes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {writeText: jest.fn().mockResolvedValue('')},
    });
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

  it('should include context utilization when attribute is present', () => {
    const attributes = {
      'gen_ai.operation.type': 'ai_client',
      'gen_ai.context.utilization': '0.45',
      'gen_ai.context.window_size': '128000',
      'gen_ai.usage.total_tokens': '57600',
    };

    const result = getHighlightedSpanAttributes({
      spanId: '123',
      attributes,
    });

    expect(result.find(attr => attr.name === 'Context Utilization')).toBeDefined();
  });

  it('should not include context utilization when attribute is absent', () => {
    const attributes = {
      'gen_ai.operation.type': 'ai_client',
    };

    const result = getHighlightedSpanAttributes({
      spanId: '123',
      attributes,
    });

    expect(result.find(attr => attr.name === 'Context Utilization')).toBeUndefined();
  });

  it('should not include context utilization when value is 0', () => {
    const attributes = {
      'gen_ai.operation.type': 'ai_client',
      'gen_ai.context.utilization': '0',
      'gen_ai.context.window_size': '128000',
    };

    const result = getHighlightedSpanAttributes({
      spanId: '123',
      attributes,
    });

    expect(result.find(attr => attr.name === 'Context Utilization')).toBeUndefined();
  });

  it('shows model cost setup callout when ai_client span has tokens and is missing model', async () => {
    const organization = OrganizationFixture();
    const attributes = {
      'gen_ai.operation.type': 'ai_client',
      'gen_ai.usage.input_tokens': '10',
      'gen_ai.usage.output_tokens': '20',
      'gen_ai.usage.total_tokens': '30',
    };

    const result = getHighlightedSpanAttributes({
      spanId: 'missing-model-span',
      attributes,
    });
    const modelAttribute = result.find(attr => attr.name === 'Model');

    render(<div>{modelAttribute?.value}</div>, {organization});

    expect(screen.getByText('No model data')).toBeInTheDocument();
    await waitFor(() => {
      expect(Sentry.captureMessage).toHaveBeenCalledWith(
        'AI span cost setup callout',
        expect.objectContaining({
          level: 'info',
          tags: expect.objectContaining({
            action: 'shown',
            has_token_counts: 'true',
            span_id: 'missing-model-span',
          }),
        })
      );
    });
  });

  it('does not show model cost setup callout when ai_client span is missing tokens', () => {
    const attributes = {
      'gen_ai.operation.type': 'ai_client',
    };

    const result = getHighlightedSpanAttributes({
      spanId: 'missing-model-span',
      attributes,
    });

    expect(result.find(attr => attr.name === 'Model')).toBeUndefined();
  });

  it('emits a Sentry message when cost setup docs are opened', async () => {
    const organization = OrganizationFixture();
    const attributes = {
      'gen_ai.operation.type': 'ai_client',
      'gen_ai.usage.input_tokens': '10',
      'gen_ai.usage.output_tokens': '20',
      'gen_ai.usage.total_tokens': '30',
    };

    const result = getHighlightedSpanAttributes({
      spanId: 'missing-model-span',
      attributes,
    });
    const modelAttribute = result.find(attr => attr.name === 'Model');

    render(<div>{modelAttribute?.value}</div>, {organization});

    await userEvent.hover(screen.getByText('No model data'));
    await userEvent.click(await screen.findByRole('link', {name: 'Docs'}));

    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'AI span cost setup callout',
      expect.objectContaining({
        level: 'info',
        tags: expect.objectContaining({
          action: 'docs_click',
          has_token_counts: 'true',
          span_id: 'missing-model-span',
        }),
      })
    );
    expect(trackAnalytics).toHaveBeenCalledWith(
      'agent-monitoring.model-cost-callout-docs-click',
      expect.objectContaining({
        hasTokenCounts: true,
      })
    );
  });

  it('emits a Sentry message when LLM cost setup instructions are copied', async () => {
    const organization = OrganizationFixture();
    const attributes = {
      'gen_ai.operation.type': 'ai_client',
      'gen_ai.usage.input_tokens': '10',
      'gen_ai.usage.output_tokens': '20',
      'gen_ai.usage.total_tokens': '30',
    };

    const result = getHighlightedSpanAttributes({
      spanId: 'missing-model-span',
      attributes,
    });
    const modelAttribute = result.find(attr => attr.name === 'Model');

    render(<div>{modelAttribute?.value}</div>, {organization});

    await userEvent.hover(screen.getByText('No model data'));
    await userEvent.click(
      await screen.findByRole('button', {name: 'Copy LLM instructions'})
    );

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('gen_ai.response.model')
    );
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'AI span cost setup callout',
      expect.objectContaining({
        level: 'info',
        tags: expect.objectContaining({
          action: 'copy_instructions',
          has_token_counts: 'true',
          span_id: 'missing-model-span',
        }),
      })
    );
    expect(trackAnalytics).toHaveBeenCalledWith(
      'agent-monitoring.model-cost-callout-copy-click',
      expect.objectContaining({
        hasTokenCounts: true,
      })
    );
  });

  it('tracks when the model cost setup tooltip is hovered', async () => {
    const organization = OrganizationFixture();
    const attributes = {
      'gen_ai.operation.type': 'ai_client',
      'gen_ai.usage.input_tokens': '10',
      'gen_ai.usage.output_tokens': '20',
      'gen_ai.usage.total_tokens': '30',
    };

    const result = getHighlightedSpanAttributes({
      spanId: 'missing-model-span',
      attributes,
    });
    const modelAttribute = result.find(attr => attr.name === 'Model');

    render(<div>{modelAttribute?.value}</div>, {organization});

    await userEvent.hover(screen.getByText('No model data'));

    expect(trackAnalytics).toHaveBeenCalledWith(
      'agent-monitoring.model-cost-callout-tooltip-hover',
      expect.objectContaining({
        hasTokenCounts: true,
      })
    );
  });
});
