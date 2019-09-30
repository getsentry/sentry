import {mount} from 'enzyme';
import React from 'react';

import {initializeOrg} from 'app-test/helpers/initializeOrg';
import {selectByLabel} from 'app-test/helpers/select';
import {RuleFormContainer} from 'app/views/settings/incidentRules/ruleForm';

describe('Incident Rules Form', function() {
  const {organization, project, routerContext} = initializeOrg();
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
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
  });

  describe('Creating a new rule', function() {
    let createRule;
    beforeEach(function() {
      createRule = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/alert-rules/',
        method: 'POST',
      });
    });

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
            excludedProjects: ['project-2'],
            projects: ['project-slug'],
          }),
        })
      );
    });
  });

  describe('Editing a rule', function() {
    let editRule;
    const rule = TestStubs.IncidentRule();

    beforeEach(function() {
      editRule = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/alert-rules/${rule.id}/`,
        method: 'PUT',
        body: rule,
      });
    });

    it('keeps state of projects and excluded projects when toggling "Include all projects"', async function() {
      const wrapper = createWrapper({
        incidentRuleId: rule.id,
        initialData: rule,
        saveOnBlur: true,
      });

      selectByLabel(wrapper, 'project-slug', {name: 'projects'});

      expect(editRule).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            projects: ['project-slug'],
          },
        })
      );
      editRule.mockReset();

      // Toggle include all projects to on
      wrapper.find('button#includeAllProjects').simulate('click');
      expect(editRule).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            includeAllProjects: true,
          },
        })
      );
      editRule.mockReset();

      // Exclude 2nd project
      selectByLabel(wrapper, 'project-2', {name: 'excludedProjects'});
      expect(editRule).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            excludedProjects: ['project-2'],
          },
        })
      );
      editRule.mockReset();

      // Toggle back to not include all projects
      wrapper.find('button#includeAllProjects').simulate('click');
      expect(editRule).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            includeAllProjects: false,
          },
        })
      );
    });
  });
});
