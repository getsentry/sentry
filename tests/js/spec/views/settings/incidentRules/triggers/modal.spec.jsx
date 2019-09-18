import {mount} from 'enzyme';
import React from 'react';

import {initializeOrg} from 'app-test/helpers/initializeOrg';
import {selectByLabel} from 'app-test/helpers/select';
import TriggersModal from 'app/views/settings/incidentRules/triggers/modal';

describe('Incident Rules -> Triggers Modal', function() {
  const {organization, project, routerContext} = initializeOrg();
  const rule = TestStubs.IncidentRule();
  let statsMock;
  const createWrapper = props =>
    mount(
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

  it('selects a Project to use for chart and changes project after chart renders', async function() {
    const wrapper = createWrapper();

    expect(wrapper.find('SelectProjectPlaceholder')).toHaveLength(1);

    await tick();
    expect(statsMock).not.toHaveBeenCalled();

    selectByLabel(wrapper, 'project-slug', {control: true});

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

    // Select a new project
    selectByLabel(wrapper, 'project-2', {control: true});

    // New API call for updated project
    expect(statsMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        // Only check for project for now
        query: expect.objectContaining({
          project: [3],
        }),
      })
    );
  });
});
