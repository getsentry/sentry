import {AutomationFixture} from 'sentry-fixture/automations';
import {IssueStreamDetectorFixture} from 'sentry-fixture/detectors';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {DetectorListConnectedAutomations} from 'sentry/views/detectors/components/detectorListConnectedAutomations';
import {IssueStreamDetectorContextProvider} from 'sentry/views/detectors/components/detectorListTable/issueStreamDetectorContext';

describe('DetectorListConnectedAutomations', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders combined count of direct and project alerts', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      body: [
        AutomationFixture({id: '1', name: 'Direct Alert'}),
        AutomationFixture({id: '2', name: 'Project Alert'}),
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [IssueStreamDetectorFixture({workflowIds: ['2']})],
    });

    render(<DetectorListConnectedAutomations automationIds={['1']} projectId="1" />);

    expect(await screen.findByText('2 alerts')).toBeInTheDocument();
  });

  it('deduplicates automation ids from both sources', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      body: [AutomationFixture({id: '1', name: 'Shared Alert'})],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [IssueStreamDetectorFixture({workflowIds: ['1']})],
    });

    render(<DetectorListConnectedAutomations automationIds={['1']} projectId="1" />);

    expect(await screen.findByText('1 alert')).toBeInTheDocument();
  });

  it('renders empty cell when no automations are connected', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [IssueStreamDetectorFixture({workflowIds: []})],
    });

    render(<DetectorListConnectedAutomations automationIds={[]} projectId="1" />);

    // EmptyCell renders an em dash
    expect(await screen.findByText('—')).toBeInTheDocument();
  });

  it('shows automation names in hovercard on hover', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      body: [
        AutomationFixture({id: '1', name: 'Direct Alert'}),
        AutomationFixture({id: '2', name: 'Project Alert'}),
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [IssueStreamDetectorFixture({workflowIds: ['2']})],
    });

    render(<DetectorListConnectedAutomations automationIds={['1']} projectId="1" />);

    await userEvent.hover(await screen.findByText('2 alerts'));

    const directAlert = await screen.findByText('Direct Alert');
    const projectAlert = screen.getByText('Project Alert');

    expect(directAlert.closest('a')).toHaveAttribute(
      'href',
      '/organizations/org-slug/monitors/alerts/1/'
    );
    expect(projectAlert.closest('a')).toHaveAttribute(
      'href',
      '/organizations/org-slug/monitors/alerts/2/'
    );
  });

  it('uses batch context instead of per-row request when provider is present', async () => {
    const batchDetectorsRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [
        IssueStreamDetectorFixture({projectId: '1', workflowIds: ['2']}),
        IssueStreamDetectorFixture({id: '5', projectId: '2', workflowIds: ['3']}),
      ],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      body: [
        AutomationFixture({id: '1', name: 'Direct Alert'}),
        AutomationFixture({id: '2', name: 'Project Alert'}),
      ],
    });

    render(
      <IssueStreamDetectorContextProvider projectIds={['1', '2']}>
        <DetectorListConnectedAutomations automationIds={['1']} projectId="1" />
      </IssueStreamDetectorContextProvider>
    );

    expect(await screen.findByText('2 alerts')).toBeInTheDocument();

    // Only one batch request should have been made for detectors
    await waitFor(() => {
      expect(batchDetectorsRequest).toHaveBeenCalledTimes(1);
    });
    expect(batchDetectorsRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/detectors/',
      expect.objectContaining({
        query: expect.objectContaining({
          project: [1, 2],
          query: 'type:issue_stream',
        }),
      })
    );
  });
});
