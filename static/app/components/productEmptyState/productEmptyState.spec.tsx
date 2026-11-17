import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProductEmptyState} from './productEmptyState';

describe('ProductEmptyState', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({id: 'proj-123', slug: 'my-project'});
  const url = `/organizations/${organization.slug}/agent-handoff/prompts/`;
  const code = 'sntryh_example';
  const handoffId = 'a'.repeat(32);
  const write = jest.fn();

  const baseProps = {
    title: 'Search and visualize logs at scale',
    benefits: ['View logs in context with errors', 'Query and filter by any attribute'],
    media: <img src="/test.svg" alt="test" />,
    agentSteps: ['Install the Sentry CLI', 'Configure logs', 'Verify logs arrive'],
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

  it('"Copy prompt" posts add_feature with the project context', async () => {
    const mint = MockApiClient.addMockResponse({
      url,
      method: 'POST',
      body: {code, handoffId, expiresAt: new Date(Date.now() + 300_000).toISOString()},
    });
    const onPromptCopied = jest.fn();

    render(<ProductEmptyState {...baseProps} onPromptCopied={onPromptCopied} />, {
      organization,
    });

    await userEvent.click(screen.getByRole('button', {name: 'Copy prompt'}));

    await waitFor(() => expect(onPromptCopied).toHaveBeenCalledWith(handoffId));
    expect(mint).toHaveBeenCalledWith(
      url,
      expect.objectContaining({
        data: {
          context: {product: 'tracing', projectId: 'proj-123'},
          disableIpPinning: false,
          flow: 'add_feature',
        },
      })
    );
  });

  it('"Set up manually" shows the manual content', async () => {
    render(
      <ProductEmptyState
        {...baseProps}
        manualSetup={<div data-test-id="manual-content">Manual steps here</div>}
      />,
      {organization}
    );

    await userEvent.click(screen.getByRole('radio', {name: 'Set up manually'}));

    expect(screen.getByTestId('manual-content')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Copy prompt'})).not.toBeInTheDocument();
  });
});
