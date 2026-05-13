import type {ComponentProps} from 'react';
import {SentryAppFixture} from 'sentry-fixture/sentryApp';
import {SentryAppInstallationFixture} from 'sentry-fixture/sentryAppInstallation';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {SentryAppExternalFormNew} from 'sentry/views/settings/organizationIntegrations/sentryAppExternalForm.new';

describe('SentryAppExternalFormNew', () => {
  const sentryApp = SentryAppFixture();
  const sentryAppInstallation = SentryAppInstallationFixture();
  const externalRequestUrl = `/sentry-app-installations/${sentryAppInstallation.uuid}/external-requests/`;

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('cascades transitive dependent field defaults', async () => {
    const boardRequest = MockApiClient.addMockResponse({
      method: 'GET',
      url: externalRequestUrl,
      body: {
        defaultValue: 'R',
        choices: [
          ['R', 'board R'],
          ['S', 'board S'],
        ],
      },
      match: [
        MockApiClient.matchQuery({
          uri: '/integrations/sentry/boards',
          dependentData: JSON.stringify({project_id: 'A'}),
        }),
      ],
    });

    const issueTypeRequest = MockApiClient.addMockResponse({
      method: 'GET',
      url: externalRequestUrl,
      body: {
        defaultValue: 'bug',
        choices: [
          ['bug', 'Bug'],
          ['task', 'Task'],
        ],
      },
      match: [
        MockApiClient.matchQuery({
          uri: '/integrations/sentry/ticket-types',
          dependentData: JSON.stringify({board_id: 'R'}),
        }),
      ],
    });

    const config: ComponentProps<typeof SentryAppExternalFormNew>['config'] = {
      uri: '/integrations/sentry/issues/create',
      required_fields: [
        {
          type: 'select',
          name: 'project_id',
          label: 'Project',
          choices: [
            ['A', 'project A'],
            ['B', 'project B'],
          ],
        },
        {
          type: 'select',
          name: 'board_id',
          label: 'Board',
          uri: '/integrations/sentry/boards',
          choices: [],
          depends_on: ['project_id'],
        },
        {
          type: 'select',
          name: 'issue_type',
          label: 'Issue Type',
          uri: '/integrations/sentry/ticket-types',
          choices: [],
          depends_on: ['board_id'],
        },
      ],
    };

    render(
      <SentryAppExternalFormNew
        sentryAppInstallationUuid={sentryAppInstallation.uuid}
        appName={sentryApp.name}
        config={config}
        action="create"
        element="alert-rule-action"
        onSubmitSuccess={jest.fn()}
      />
    );

    expect(screen.getByRole('textbox', {name: 'Board'})).toBeDisabled();
    expect(screen.getByRole('textbox', {name: 'Issue Type'})).toBeDisabled();
    expect(boardRequest).not.toHaveBeenCalled();
    expect(issueTypeRequest).not.toHaveBeenCalled();

    await selectEvent.select(screen.getByRole('textbox', {name: 'Project'}), 'project A');

    // The BFS fetches issue-types only after boards resolves with a default,
    // so waiting on the transitive call implies the parent fetch already ran.
    await waitFor(() => expect(issueTypeRequest).toHaveBeenCalledTimes(1));
    expect(boardRequest).toHaveBeenCalledTimes(1);

    expect(screen.getByText('board R')).toBeInTheDocument();
    expect(screen.getByText('Bug')).toBeInTheDocument();
  });
});
