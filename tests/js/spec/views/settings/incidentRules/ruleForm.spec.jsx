import {mountWithTheme} from 'sentry-test/enzyme';
import React from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {selectByLabel} from 'sentry-test/select';
import {RuleFormContainer} from 'app/views/settings/incidentRules/ruleForm';

describe('Incident Rules Form', function() {
  const {organization, project, routerContext} = initializeOrg();
  const createWrapper = props =>
    mountWithTheme(
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
    it('creates a rule', async function() {
      const wrapper = createWrapper();

      selectByLabel(wrapper, 'project-slug', {name: 'projects'});

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
            includeAllProjects: false,
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

    it('edits projects', async function() {
      const wrapper = createWrapper({
        incidentRuleId: rule.id,
        initialData: rule,
        saveOnBlur: true,
      });

      selectByLabel(wrapper, 'project-2', {name: 'projects'});

      expect(editRule).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            projects: ['project-2'],
          },
        })
      );
      editRule.mockReset();
    });
  });
});
