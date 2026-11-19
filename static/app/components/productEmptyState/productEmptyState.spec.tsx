import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Image} from '@sentry/scraps/image';

import * as analytics from 'sentry/utils/analytics';

import {ProductEmptyState} from './productEmptyState';

describe('ProductEmptyState', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({id: 'proj-123', slug: 'my-project', platform: 'node'});
  const url = `/organizations/${organization.slug}/agent-handoff/prompts/`;
  const code = 'sntryh_example';
  const handoffId = 'a'.repeat(32);
  const write = jest.fn();

  const baseProps = {
    title: 'Search and visualize logs at scale',
    benefits: ['View logs in context with errors', 'Query and filter by any attribute'],
    media: <Image src="/test.svg" alt="test" />,
    agentSteps: ['Install the Sentry CLI', 'Configure logs', 'Verify logs arrive'],
    manualSetup: <div data-test-id="manual-content">Manual steps here</div>,
    product: 'tracing' as const,
    productName: 'Tracing',
    project,
    feedbackSource: 'product-empty-state-test',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    class TestClipboardItem {
      constructor(public data: Record<string, Promise<Blob>>) {}
    }
    Object.assign(globalThis, {ClipboardItem: TestClipboardItem});
    write.mockResolvedValue(undefined);
    Object.assign(navigator, {clipboard: {write}});
  });

  afterEach(() => {
    jest.restoreAllMocks();
    Reflect.deleteProperty(navigator, 'clipboard');
    Reflect.deleteProperty(globalThis, 'ClipboardItem');
  });

  it('shows the product name and project in the card header', () => {
    render(<ProductEmptyState {...baseProps} />, {organization});

    expect(screen.getByText(/Set up Tracing for/)).toBeInTheDocument();
    expect(screen.getByText('my-project')).toBeInTheDocument();
  });

  it('fires agent_setup_viewed on mount', () => {
    const trackAnalytics = jest.spyOn(analytics, 'trackAnalytics');

    render(<ProductEmptyState {...baseProps} />, {organization});

    expect(trackAnalytics).toHaveBeenCalledWith(
      'product_empty_state.agent_setup_viewed',
      {
        organization: expect.objectContaining({id: organization.id}),
        platform: 'node',
        product: 'tracing',
        project_id: 'proj-123',
      }
    );
  });

  it('fires agent_setup_command_copied with handoff_id after copying', async () => {
    MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {code, handoffId, expiresAt: new Date(Date.now() + 300_000).toISOString()},
    });
    const trackAnalytics = jest.spyOn(analytics, 'trackAnalytics');

    render(<ProductEmptyState {...baseProps} />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'Copy prompt'}));

    await waitFor(() =>
      expect(trackAnalytics).toHaveBeenCalledWith(
        'product_empty_state.agent_setup_command_copied',
        {
          organization: expect.objectContaining({id: organization.id}),
          handoff_id: handoffId,
          platform: 'node',
          product: 'tracing',
          project_id: 'proj-123',
        }
      )
    );
  });

  it('fires agent_setup_mode_selected when switching to manual', async () => {
    const trackAnalytics = jest.spyOn(analytics, 'trackAnalytics');

    render(<ProductEmptyState {...baseProps} />, {organization});

    await userEvent.click(screen.getByRole('radio', {name: 'Set up manually'}));

    expect(trackAnalytics).toHaveBeenCalledWith(
      'product_empty_state.agent_setup_mode_selected',
      {
        organization: expect.objectContaining({id: organization.id}),
        mode: 'manual',
        product: 'tracing',
        project_id: 'proj-123',
      }
    );
  });

  it('"Set up manually" shows the manual content', async () => {
    render(<ProductEmptyState {...baseProps} />, {organization});

    await userEvent.click(screen.getByRole('radio', {name: 'Set up manually'}));

    expect(screen.getByTestId('manual-content')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Copy prompt'})).not.toBeInTheDocument();
  });
});
