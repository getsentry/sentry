import {mount} from 'enzyme';
import React from 'react';

import {initializeOrg} from 'app-test/helpers/initializeOrg';
import {selectByLabel} from 'app-test/helpers/select';
import {RuleFormContainer} from 'app/views/settings/incidentRules/ruleForm';

describe('Incident Rules Form', function() {
  const {organization, project, routerContext} = initializeOrg();
  const rule = TestStubs.IncidentRule();
  let createRule;
  const createWrapper = props =>
    mount(
      <RuleFormContainer
        organization={organization}
        orgId={organization.slug}
        projects={[project, TestStubs.Project({slug: 'project-2', id: '3'})]}
        {...props}
      />,
      routerContext
    );
  beforeEach(function() {
    MockApiClient.clearMockResponses();
    createRule = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/alert-rules/',
      method: 'POST',
    });
  });

  describe('Creating a new rule', function() {
    /**
     * Note this isn't necessarily the desired behavior, as it is just documenting the behavior
     */
    it('keeps state of projects and excluded projects when toggling "Include all projects"', async function() {
      const wrapper = createWrapper();

      selectByLabel(wrapper, 'project-slug', {name: 'projects'});

      // Toggle include all projects to on
      wrapper.find('button#includeAllProjects').simulate('click');

      // Exclude 2nd project
      selectByLabel(wrapper, 'project-2', {name: 'excludedProjects'});

      // Toggle back to not include all projects
      wrapper.find('button#includeAllProjects').simulate('click');

      // Select field should have project-slug selected
      expect(
        wrapper
          .find('SelectField[name="projects"] .Select-value-label')
          .text()
          .trim()
      ).toBe('project-slug');

      // Toggle back include all projects
      wrapper.find('button#includeAllProjects').simulate('click');

      // Select field should have project-slug selected
      expect(
        wrapper
          .find('SelectField[name="excludedProjects"] .Select-value-label')
          .text()
          .trim()
      ).toBe('project-2');

      // Enter in name so we can submit
      wrapper
        .find('input[name="name"]')
        .simulate('change', {target: {value: 'Incident Rule'}});
      wrapper.find('form').simulate('submit');

      expect(createRule).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'Incident Rule',

            // Note, backend handles this when ideally `includeAllProjects: true` should only send excludedProjects,
            // and `includeAllProjects: false` send `projects`
            includeAllProjects: true,

            // TODO: jest doesn't like this
            // excludedProjects: ['project-2'],
            // projects: ['project-slug'],
          }),
        })
      );
    });
  });

  describe('Editing a rule', function() {});
});
