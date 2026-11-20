import {AutofixSetupFixture} from 'sentry-fixture/autofixSetupFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {ReplayReaderProvider} from 'sentry/utils/replays/playback/providers/replayReaderProvider';
import {ReplayReader} from 'sentry/utils/replays/replayReader';

import {FocusTabs} from './focusTabs';

describe('FocusTabs', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/seer/setup-check/',
      body: AutofixSetupFixture({}),
    });
  });

  it('allows selecting Logs for a supported Cocoa replay', async () => {
    const project = ProjectFixture({hasLogs: true});
    ProjectsStore.loadInitialData([project]);
    const replay = ReplayReader.factory({
      attachments: [],
      errors: [],
      fetching: false,
      replayRecord: ReplayRecordFixture({
        project_id: project.id,
        sdk: {name: 'sentry.cocoa', version: '9.24.0'},
      }),
    });

    const {router} = render(
      <ReplayReaderProvider replay={replay}>
        <FocusTabs isVideoReplay />
      </ReplayReaderProvider>,
      {organization: OrganizationFixture({features: ['ourlogs-enabled']})}
    );

    await userEvent.click(screen.getByRole('tab', {name: 'Logs'}));

    await waitFor(() => expect(router.location.query.t_main).toBe('logs'));
    expect(screen.getByRole('tab', {name: 'Logs'})).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
});
