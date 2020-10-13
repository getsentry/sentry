import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import RuleFormContainer from 'app/views/settings/incidentRules/ruleForm';

describe('Incident Rules Form', function () {
  const {organization, project, routerContext} = initializeOrg();
  const createWrapper = props =>
    mountWithTheme(
      <RuleFormContainer
        params={{orgId: organization.slug, projectId: project.slug}}
        organization={organization}
        project={project}
        {...props}
      />,
      routerContext
    );

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/environments/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: TestStubs.EventsStats(),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/alert-rules/available-actions/',
      body: [
        {
          allowedTargetTypes: ['user', 'team'],
          integrationName: null,
          type: 'email',
          integrationId: null,
        },
      ],
    });
  });

  describe('Creating a new rule', function () {
    let createRule;
    beforeEach(function () {
      createRule = MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/alert-rules/',
        method: 'POST',
      });
    });

    /**
     * Note this isn't necessarily the desired behavior, as it is just documenting the behavior
     */
    it('creates a rule', async function () {
      const rule = TestStubs.IncidentRule();
      const wrapper = createWrapper({
        rule: {
          ...rule,
          id: undefined,
        },
      });

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
            projects: ['project-slug'],
          }),
        })
      );
    });
  });

  describe('Editing a rule', function () {
    let editRule;
    let editTrigger;
    const rule = TestStubs.IncidentRule();

    beforeEach(function () {
      editRule = MockApiClient.addMockResponse({
        url: `/projects/org-slug/project-slug/alert-rules/${rule.id}/`,
        method: 'PUT',
        body: rule,
      });
      editTrigger = MockApiClient.addMockResponse({
        url: `/organizations/org-slug/alert-rules/${rule.id}/triggers/1/`,
        method: 'PUT',
        body: TestStubs.IncidentTrigger({id: 1}),
      });
    });
    afterEach(function () {
      editRule.mockReset();
      editTrigger.mockReset();
    });

    it('edits metric', async function () {
      const wrapper = createWrapper({
        ruleId: rule.id,
        rule,
      });

      wrapper
        .find('input[name="name"]')
        .simulate('change', {target: {value: 'new name'}});

      wrapper.find('form').simulate('submit');

      expect(editRule).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'new name',
          }),
        })
      );
    });
  });
});
