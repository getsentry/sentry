import {mountWithTheme} from 'sentry-test/enzyme';
import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import TriggersModal from 'app/views/settings/incidentRules/triggers/modal';

describe('Incident Rules -> Triggers Modal', function() {
  const {organization, project, routerContext} = initializeOrg();
  const rule = TestStubs.IncidentRule();
  let statsMock;
  const createWrapper = props =>
    mountWithTheme(
      <TriggersModal
        organization={organization}
        projects={[project, TestStubs.Project({slug: 'project-2', id: '3'})]}
        rule={rule}
        {...props}
      />,
      routerContext
    );
  beforeEach(function() {
    MockApiClient.clearMockResponses();
    statsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
    });
  });

  it('renders chart', async function() {
    const wrapper = createWrapper();
    await tick();
    wrapper.update();

    // API call to render chart
    expect(statsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        // Only check for project for now
        query: expect.objectContaining({
          project: [2],
        }),
      })
    );

    // Chart renders
    expect(wrapper.find('LineChart')).toHaveLength(1);
  });
});
