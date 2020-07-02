import React from 'react';
import sortBy from 'lodash/sortBy';

import {mountWithTheme} from 'sentry-test/enzyme';

import DataScrubbing from 'app/views/settings/components/dataScrubbing';
import {
  ProjectId,
  MethodType,
  RuleType,
} from 'app/views/settings/components/dataScrubbing/types';
import {
  getMethodLabel,
  getRuleLabel,
} from 'app/views/settings/components/dataScrubbing/utils';
import {addSuccessMessage} from 'app/actionCreators/indicator';

// @ts-ignore
const relayPiiConfig = TestStubs.DataScrubbingRelayPiiConfig();
const stringRelayPiiConfig = JSON.stringify(relayPiiConfig);
const organizationSlug = 'sentry';
const handleUpdateOrganization = jest.fn();
const additionalContext = 'These rules can be configured for each project.';

jest.mock('app/actionCreators/indicator');

function getOrganization(piiConfig?: string) {
  // @ts-ignore
  return TestStubs.Organization(
    piiConfig ? {id: '123', relayPiiConfig: piiConfig} : {id: '123'}
  );
}

function renderComponent({
  disabled,
  projectId,
  endpoint,
  ...props
}: Partial<Omit<DataScrubbing<ProjectId>['props'], 'endpoint'>> &
  Pick<DataScrubbing<ProjectId>['props'], 'endpoint'>) {
  const organization = props.organization ?? getOrganization();
  if (projectId) {
    return mountWithTheme(
      <DataScrubbing
        additionalContext={additionalContext}
        endpoint={endpoint}
        projectId={projectId}
        relayPiiConfig={stringRelayPiiConfig}
        disabled={disabled}
        organization={organization}
        onSubmitSuccess={handleUpdateOrganization}
      />
    );
  }
  return mountWithTheme(
    <DataScrubbing
      additionalContext={additionalContext}
      endpoint={endpoint}
      relayPiiConfig={stringRelayPiiConfig}
      disabled={disabled}
      organization={organization}
      onSubmitSuccess={handleUpdateOrganization}
    />
  );
}

describe('Data Scrubbing', () => {
  describe('Organization level', () => {
    const endpoint = `organization/${organizationSlug}/`;

    it('default render', () => {
      const wrapper = renderComponent({disabled: false, endpoint});

      // PanelHeader
      expect(wrapper.find('PanelHeader').text()).toEqual('Advanced Data Scrubbing');

      //PanelAlert
      const panelAlert = wrapper.find('PanelAlert');
      expect(panelAlert.text()).toEqual(
        `${additionalContext} The new rules will only apply to upcoming events.  For more details, see full documentation on data scrubbing.`
      );

      const readDocsLink = panelAlert.find('a');
      expect(readDocsLink.text()).toEqual('full documentation on data scrubbing');
      expect(readDocsLink.prop('href')).toEqual(
        'https://docs.sentry.io/data-management/advanced-datascrubbing/'
      );

      //PanelBody
      const panelBody = wrapper.find('PanelBody');
      expect(panelBody).toHaveLength(1);
      expect(panelBody.find('ListItem')).toHaveLength(2);

      // OrganizationRules
      const organizationRules = panelBody.find('OrganizationRules');
      expect(organizationRules).toHaveLength(0);

      // PanelAction
      const actionButtons = wrapper.find('PanelAction').find('Button');
      expect(actionButtons).toHaveLength(2);
      expect(actionButtons.at(0).text()).toEqual('Read the docs');
      expect(actionButtons.at(1).text()).toEqual('Add Rule');
      expect(actionButtons.at(1).prop('disabled')).toEqual(false);
    });

    it('render disabled', () => {
      const wrapper = renderComponent({disabled: true, endpoint});

      //PanelBody
      const panelBody = wrapper.find('PanelBody');
      expect(panelBody).toHaveLength(1);
      expect(panelBody.find('List').prop('isDisabled')).toEqual(true);

      // PanelAction
      const actionButtons = wrapper.find('PanelAction').find('Button');
      expect(actionButtons).toHaveLength(2);
      expect(actionButtons.at(0).prop('disabled')).toEqual(false);
      expect(actionButtons.at(1).prop('disabled')).toEqual(true);
    });
  });

  describe('Project level', () => {
    const projectId = 'foo';
    const endpoint = `/projects/${organizationSlug}/${projectId}/`;

    it('default render', () => {
      const wrapper = renderComponent({
        disabled: false,
        projectId,
        endpoint,
      });

      // PanelHeader
      expect(wrapper.find('PanelHeader').text()).toEqual('Advanced Data Scrubbing');

      //PanelAlert
      const panelAlert = wrapper.find('PanelAlert');
      expect(panelAlert.text()).toEqual(
        `${additionalContext} The new rules will only apply to upcoming events.  For more details, see full documentation on data scrubbing.`
      );

      const readDocsLink = panelAlert.find('a');
      expect(readDocsLink.text()).toEqual('full documentation on data scrubbing');
      expect(readDocsLink.prop('href')).toEqual(
        'https://docs.sentry.io/data-management/advanced-datascrubbing/'
      );

      //PanelBody
      const panelBody = wrapper.find('PanelBody');
      expect(panelBody).toHaveLength(1);
      expect(panelBody.find('ListItem')).toHaveLength(2);

      // OrganizationRules
      const organizationRules = panelBody.find('OrganizationRules');
      expect(organizationRules).toHaveLength(1);
      expect(organizationRules.text()).toEqual(
        'There are no data scrubbing rules at the organization level'
      );

      // PanelAction
      const actionButtons = wrapper.find('PanelAction').find('Button');
      expect(actionButtons).toHaveLength(2);
      expect(actionButtons.at(0).text()).toEqual('Read the docs');
      expect(actionButtons.at(1).text()).toEqual('Add Rule');
      expect(actionButtons.at(1).prop('disabled')).toEqual(false);
    });

    it('render disabled', () => {
      const wrapper = renderComponent({disabled: true, endpoint});

      //PanelBody
      const panelBody = wrapper.find('PanelBody');
      expect(panelBody).toHaveLength(1);
      expect(panelBody.find('List').prop('isDisabled')).toEqual(true);

      // PanelAction
      const actionButtons = wrapper.find('PanelAction').find('Button');
      expect(actionButtons).toHaveLength(2);
      expect(actionButtons.at(0).prop('disabled')).toEqual(false);
      expect(actionButtons.at(1).prop('disabled')).toEqual(true);
    });

    it('OrganizationRules has content', () => {
      const wrapper = renderComponent({
        disabled: false,
        organization: getOrganization(stringRelayPiiConfig),
        projectId,
        endpoint,
      });

      // OrganizationRules
      const organizationRules = wrapper.find('OrganizationRules');
      expect(organizationRules).toHaveLength(1);
      expect(organizationRules.find('Header').text()).toEqual('Organization Rules');
      const listItems = organizationRules.find('ListItem');
      expect(listItems).toHaveLength(2);
      expect(listItems.at(0).find('[role="button"]')).toHaveLength(0);
    });

    it('Delete rule successfully', async () => {
      // @ts-ignore
      const mockDelete = MockApiClient.addMockResponse({
        url: endpoint,
        method: 'PUT',
        body: getOrganization(
          JSON.stringify({...relayPiiConfig, rules: {0: relayPiiConfig.rules[0]}})
        ),
      });

      const wrapper = renderComponent({
        disabled: false,
        projectId,
        endpoint,
      });

      const listItems = wrapper.find('ListItem');
      const deleteButton = listItems
        .at(0)
        .find('[aria-label="Delete Rule"]')
        .hostNodes();

      deleteButton.simulate('click');
      expect(mockDelete).toHaveBeenCalled();

      // @ts-ignore
      await tick();
      wrapper.update();

      expect(wrapper.find('ListItem')).toHaveLength(1);
      expect(addSuccessMessage).toHaveBeenCalled();
    });

    it('Open Add Rule Modal', () => {
      const wrapper = renderComponent({
        disabled: false,
        projectId,
        endpoint,
      });

      const addbutton = wrapper
        .find('PanelAction')
        .find('[aria-label="Add Rule"]')
        .hostNodes();

      addbutton.simulate('click');

      // Modal
      const addRuleModal = wrapper.find('[data-test-id="add-rule-modal"]').hostNodes();
      expect(addRuleModal).toHaveLength(1);

      expect(addRuleModal.find('.modal-header >*:last-child').text()).toEqual(
        'Add an advanced data scrubbing rule'
      );

      // Method Field
      const methodField = addRuleModal.find('SelectField[name="method"]');
      expect(methodField.exists()).toBe(true);
      const methodFieldProps = methodField.props();
      expect(methodFieldProps.value).toEqual(MethodType.MASK);

      const methodFieldOptions = sortBy(Object.values(MethodType)).map(value => ({
        ...getMethodLabel(value),
        value,
      }));
      expect(methodFieldProps.options).toEqual(methodFieldOptions);

      // Type Field
      const typeField = addRuleModal.find('SelectField[name="type"]');
      expect(typeField.exists()).toBe(true);
      const typeFieldProps = typeField.props();
      expect(typeFieldProps.value).toEqual(RuleType.CREDITCARD);

      const typeFieldOptions = sortBy(Object.values(RuleType)).map(value => ({
        label: getRuleLabel(value),
        value,
      }));
      expect(typeFieldProps.options).toEqual(typeFieldOptions);

      // Source Field
      const sourceField = addRuleModal.find('StyledInput[name="source"]');
      expect(sourceField.exists()).toBe(true);

      // Close Dialog
      const cancelButton = addRuleModal.find('[aria-label="Cancel"]').hostNodes();
      expect(cancelButton.exists()).toBe(true);
      cancelButton.simulate('click');

      expect(wrapper.find('[data-test-id="add-rule-modal"]')).toHaveLength(0);
    });

    it('Open Edit Rule Modal', () => {
      const wrapper = renderComponent({
        disabled: false,
        projectId,
        endpoint,
      });

      const editButton = wrapper
        .find('PanelBody')
        .find('[aria-label="Edit Rule"]')
        .hostNodes();

      editButton.at(0).simulate('click');

      // Modal
      const editRuleModal = wrapper.find('[data-test-id="edit-rule-modal"]').hostNodes();
      expect(editRuleModal).toHaveLength(1);

      expect(editRuleModal.find('.modal-header >*:last-child').text()).toEqual(
        'Edit an advanced data scrubbing rule'
      );

      // Method Field
      const methodField = editRuleModal.find('SelectField[name="method"]');
      expect(methodField.exists()).toBe(true);
      const methodFieldProps = methodField.props();
      expect(methodFieldProps.value).toEqual(MethodType.REPLACE);

      const methodFieldOptions = sortBy(Object.values(MethodType)).map(value => ({
        ...getMethodLabel(value),
        value,
      }));
      expect(methodFieldProps.options).toEqual(methodFieldOptions);

      // Placeholder Field
      const placeholderField = editRuleModal.find('Input[name="placeholder"]');
      expect(placeholderField.exists()).toBe(true);
      expect(placeholderField.props().value).toEqual(
        relayPiiConfig.rules[0].redaction.text
      );

      // Type Field
      const typeField = editRuleModal.find('SelectField[name="type"]');
      expect(typeField.exists()).toBe(true);
      const typeFieldProps = typeField.props();
      expect(typeFieldProps.value).toEqual(RuleType.PASSWORD);

      const typeFieldOptions = sortBy(Object.values(RuleType)).map(value => ({
        label: getRuleLabel(value),
        value,
      }));
      expect(typeFieldProps.options).toEqual(typeFieldOptions);

      // Source Field
      const sourceField = editRuleModal.find('StyledInput[name="source"]');
      expect(sourceField.exists()).toBe(true);

      expect(sourceField.props().value).toEqual(
        Object.keys(relayPiiConfig.applications)[0]
      );

      // Close Dialog
      const cancelButton = editRuleModal.find('[aria-label="Cancel"]').hostNodes();
      expect(cancelButton.exists()).toBe(true);
      cancelButton.simulate('click');

      expect(wrapper.find('[data-test-id="edit-rule-modal"]')).toHaveLength(0);
    });
  });
});
