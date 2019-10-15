/*global global*/
import React from 'react';

import {Client} from 'app/api';
import {mountWithTheme} from 'sentry-test/enzyme';
import MigrationWarnings from 'app/views/organizationIntegrations/migrationWarnings';

jest.mock('app/actionCreators/modal', () => ({
  openIntegrationDetails: jest.fn(),
}));

describe('MigrationWarnings', function() {
  beforeEach(function() {
    Client.clearMockResponses();
  });

  describe('render()', function() {
    const org = TestStubs.Organization();
    const routerContext = TestStubs.routerContext();

    const jiraProvider = TestStubs.JiraIntegrationProvider();
    const githubProvider = TestStubs.GitHubIntegrationProvider({
      integrations: [],
      isInstalled: false,
    });

    const focus = jest.fn();
    const open = jest.fn().mockReturnValue({focus});
    global.open = open;

    Client.addMockResponse({
      url: `/organizations/${org.slug}/repos/?status=unmigratable`,
      body: [
        {
          provider: {
            id: 'github',
            name: 'GitHub',
          },
          name: 'Test-Org/foo',
        },
      ],
    });

    const wrapper = mountWithTheme(
      <MigrationWarnings
        orgId={org.slug}
        providers={[githubProvider, jiraProvider]}
        onInstall={() => {}}
      />,
      routerContext
    );

    it('fetches unmigratable repositories', function() {
      expect(wrapper.instance().state.unmigratableRepos).toHaveLength(1);
      expect(wrapper.instance().state.unmigratableRepos[0].name).toBe('Test-Org/foo');
    });

    it('displays a warning for each Org with unmigratable repos', () => {
      // Use a regex because React/Enzyme/Jest/Whatever turns single quotes into
      // apostrophes, so you can't match it explicitly.
      expect(
        wrapper
          .find('AlertLink')
          .first()
          .text()
      ).toMatch(/Your Test-Org repositories can.t send commit data to Sentry/);
    });

    it('opens the new Integration dialog when the warning is clicked', () => {
      wrapper
        .find('AlertLink')
        .first()
        .simulate('click');

      expect(open.mock.calls).toHaveLength(1);
      expect(focus.mock.calls).toHaveLength(1);
      expect(open.mock.calls[0][2]).toBe(
        'scrollbars=yes,width=100,height=100,top=334,left=462'
      );
    });
  });
});
