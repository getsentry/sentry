import {AutomationFixture} from 'sentry-fixture/automations';
import {IssueStreamDetectorFixture} from 'sentry-fixture/detectors';
import {ActionHandlerFixture} from 'sentry-fixture/workflowEngine';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AlertEmbedStory} from './alertEmbedStory';

describe('AlertEmbedStory', () => {
  it('renders an issue alert connected to any issue stream detector', async () => {
    const automation = AutomationFixture({id: '42', name: 'Issue notifications'});
    const connectedDetector = IssueStreamDetectorFixture({
      id: '2',
      workflowIds: [automation.id],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [],
      match: [MockApiClient.matchQuery({query: '!type:issue_stream'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/detectors/',
      body: [IssueStreamDetectorFixture({id: '1'}), connectedDetector],
      match: [MockApiClient.matchQuery({query: 'type:issue_stream'})],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/workflows/',
      body: [automation],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/workflows/${automation.id}/`,
      body: automation,
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/available-actions/',
      body: [ActionHandlerFixture()],
    });

    render(<AlertEmbedStory />);

    expect(await screen.findByText('Issue alert')).toBeInTheDocument();
    expect(
      (await screen.findAllByRole('link', {name: automation.name})).length
    ).toBeGreaterThan(0);
  });
});
