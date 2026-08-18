import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, renderHookWithProviders, screen} from 'sentry-test/reactTestingLibrary';

import type {CodingAgentIntegration} from 'sentry/components/events/autofix/useAutofix';
import {
  CodingAgentMenuFooter,
  useCodingAgentMenuItems,
} from 'sentry/components/events/autofix/v3/codingAgentMenu';

function integrationFixture(
  overrides: Partial<CodingAgentIntegration> = {}
): CodingAgentIntegration {
  return {id: '7', name: 'Claude Agent', provider: 'claude_code', ...overrides};
}

describe('useCodingAgentMenuItems', () => {
  it('builds one send-to item per integration', () => {
    const onCodingAgentHandoff = jest.fn();
    const {result} = renderHookWithProviders(() =>
      useCodingAgentMenuItems({
        codingAgentIntegrations: [integrationFixture()],
        onCodingAgentHandoff,
      })
    );

    expect(result.current).toHaveLength(1);
    const [item] = result.current;
    expect(item!.key).toBe('agent:7');
    expect(item!.textValue).toBe('Send to Claude Agent');

    item!.onAction?.();
    expect(onCodingAgentHandoff).toHaveBeenCalledWith(integrationFixture());
  });

  it('labels items that require identity setup and keys by provider when id is null', () => {
    const {result} = renderHookWithProviders(() =>
      useCodingAgentMenuItems({
        codingAgentIntegrations: [
          integrationFixture({id: null, requires_identity: true, has_identity: false}),
        ],
        onCodingAgentHandoff: jest.fn(),
      })
    );

    expect(result.current[0]!.key).toBe('agent:claude_code');
    expect(result.current[0]!.textValue).toBe('Setup Claude Agent');
  });

  it('disables items with a tooltip when a disabled reason is provided', () => {
    const {result} = renderHookWithProviders(() =>
      useCodingAgentMenuItems({
        codingAgentIntegrations: [integrationFixture()],
        codingAgentDisabledReason: 'Connect a GitHub repository.',
        onCodingAgentHandoff: jest.fn(),
      })
    );

    expect(result.current[0]!.disabled).toBe(true);
    expect(result.current[0]!.tooltip).toBe('Connect a GitHub repository.');
  });

  it('returns an empty list when integrations are undefined', () => {
    const {result} = renderHookWithProviders(() =>
      useCodingAgentMenuItems({
        codingAgentIntegrations: undefined,
        onCodingAgentHandoff: jest.fn(),
      })
    );

    expect(result.current).toEqual([]);
  });
});

describe('CodingAgentMenuFooter', () => {
  it('links to the coding-agent integrations settings', () => {
    render(<CodingAgentMenuFooter />, {
      organization: OrganizationFixture({slug: 'acme'}),
    });

    expect(screen.getByRole('button', {name: 'Add Integration'})).toHaveAttribute(
      'href',
      '/settings/acme/integrations/?category=coding%20agent'
    );
  });
});
