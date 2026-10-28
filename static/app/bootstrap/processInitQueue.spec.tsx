// We don't want to render with any of our existing providers since this will
// mirror what is actually happening when the initQueue is processed.
//
// eslint-disable-next-line no-restricted-imports
import {render} from '@testing-library/react';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';

import {act, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {processInitQueue} from 'sentry/bootstrap/processInitQueue';
import {SentryInitRenderReactComponent} from 'sentry/types/system';

describe('processInitQueue', () => {
  describe('renderReact', () => {
    it('renders setup wizards queued before and after initialization', async () => {
      window.__onSentryInit = [
        {
          component: SentryInitRenderReactComponent.SETUP_WIZARD,
          container: '#setup-wizard-container',
          name: 'renderReact',
          props: {
            enableProjectSelection: true,
            hash: '1',
          },
        },
      ];

      MockApiClient.addMockResponse({
        url: '/organizations/',
        body: [
          OrganizationFixture({
            id: '1',
            slug: 'organization-1',
            name: 'Organization 1',
            access: [],
            features: [],
          }),
        ],
      });

      MockApiClient.addMockResponse({
        url: '/organizations/organization-1/',
        body: OrganizationFixture({
          id: '1',
          slug: 'organization-1',
          name: 'Organization 1',
          features: [],
          access: [],
        }),
      });

      MockApiClient.addMockResponse({
        url: '/organizations/organization-1/projects/',
        body: [
          ProjectFixture({
            id: '1',
            slug: 'project-1',
            name: 'Project 1',
          }),
        ],
      });

      MockApiClient.addMockResponse({
        url: '/organizations/organization-1/user-teams/',
        body: [TeamFixture({id: '1', slug: 'team-1', name: 'Team 1'})],
      });

      MockApiClient.addMockResponse({
        url: '/organizations/organization-1/teams/',
        body: [TeamFixture({id: '1', slug: 'team-1', name: 'Team 1'})],
      });

      render(
        <div>
          <div id="setup-wizard-container" />
          <div id="second-setup-wizard-container" />
        </div>
      );
      const init = window.__onSentryInit[0]!;
      await act(() => processInitQueue());

      await waitFor(
        () => {
          expect(screen.getByText('Select your Sentry project')).toBeInTheDocument();
        },
        {timeout: 5000}
      );

      await processInitQueue();
      act(() => {
        window.__onSentryInit.push({
          ...init,
          container: '#second-setup-wizard-container',
        });
      });
      await waitFor(() => {
        expect(screen.getAllByText('Select your Sentry project')).toHaveLength(2);
      });
    });
  });
});
