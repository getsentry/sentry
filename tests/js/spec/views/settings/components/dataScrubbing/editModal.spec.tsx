import React from 'react';
import sortBy from 'lodash/sortBy';

import {mountWithTheme} from 'sentry-test/enzyme';

import GlobalModal from 'app/components/globalModal';
import {openModal} from 'app/actionCreators/modal';
import Edit from 'app/views/settings/components/dataScrubbing/modals/edit';
import convertRelayPiiConfig from 'app/views/settings/components/dataScrubbing/convertRelayPiiConfig';
import {MethodType, RuleType} from 'app/views/settings/components/dataScrubbing/types';
import {
  getMethodLabel,
  getRuleLabel,
  valueSuggestions,
} from 'app/views/settings/components/dataScrubbing/utils';
import submitRules from 'app/views/settings/components/dataScrubbing/submitRules';

// @ts-ignore
const relayPiiConfig = TestStubs.DataScrubbingRelayPiiConfig();
const stringRelayPiiConfig = JSON.stringify(relayPiiConfig);
const organizationSlug = 'sentry';
const convertedRules = convertRelayPiiConfig(stringRelayPiiConfig);
const rules = convertedRules;
const rule = rules[2];
const successfullySaved = jest.fn();
const projectId = 'foo';
const endpoint = `/projects/${organizationSlug}/${projectId}/`;
// @ts-ignore
const api = new MockApiClient();

jest.mock('app/views/settings/components/dataScrubbing/submitRules');

async function renderComponent() {
  const wrapper = mountWithTheme(<GlobalModal />);

  openModal(modalProps => (
    <Edit
      {...modalProps}
      projectId={projectId}
      savedRules={rules}
      api={api}
      endpoint={endpoint}
      orgSlug={organizationSlug}
      onSubmitSuccess={successfullySaved}
      rule={rule}
    />
  ));

  // @ts-ignore
  await tick();
  wrapper.update();

  return wrapper;
}

describe('Edit Modal', () => {
  it('open Edit Rule Modal', async () => {
    const wrapper = await renderComponent();

    expect(wrapper.find('[data-test-id="modal-title"]').text()).toEqual(
      'Edit an advanced data scrubbing rule'
    );

    const fieldGroup = wrapper.find('FieldGroup');
    expect(fieldGroup).toHaveLength(2);

    // Method Field
    const methodGroup = fieldGroup.at(0).find('Field');
    const methodField = methodGroup.at(0);
    expect(methodField.find('FieldLabel').text()).toEqual('Method');
    const methodFieldHelp = 'What to do';
    expect(methodField.find('QuestionTooltip').prop('title')).toEqual(methodFieldHelp);
    expect(methodField.find('Tooltip').prop('title')).toEqual(methodFieldHelp);
    const methodFieldSelect = methodField.find('SelectField');
    expect(methodFieldSelect.exists()).toBe(true);
    const methodFieldSelectProps = methodFieldSelect.props();
    expect(methodFieldSelectProps.value).toEqual(MethodType.REPLACE);
    const methodFieldSelectOptions = sortBy(Object.values(MethodType)).map(value => ({
      ...getMethodLabel(value),
      value,
    }));
    expect(methodFieldSelectProps.options).toEqual(methodFieldSelectOptions);

    // Placeholder Field
    const placeholderField = methodGroup.at(1);
    expect(placeholderField.find('FieldLabel').text()).toEqual(
      'Custom Placeholder (Optional)'
    );
    const placeholderFieldHelp = 'It will replace the default placeholder [Filtered]';
    expect(placeholderField.find('QuestionTooltip').prop('title')).toEqual(
      placeholderFieldHelp
    );
    expect(placeholderField.find('Tooltip').prop('title')).toEqual(placeholderFieldHelp);

    if (rule.method === MethodType.REPLACE) {
      const placeholderInput = placeholderField.find('input');
      expect(placeholderInput.prop('value')).toEqual(rule.placeholder);
    }

    // Type Field
    const typeGroup = fieldGroup.at(1).find('Field');
    const typeField = typeGroup.at(0);
    expect(typeField.find('FieldLabel').text()).toEqual('Data Type');
    const typeFieldHelp =
      'What to look for. Use an existing pattern or define your own using regular expressions.';
    expect(typeField.find('QuestionTooltip').prop('title')).toEqual(typeFieldHelp);
    expect(typeField.find('Tooltip').prop('title')).toEqual(typeFieldHelp);
    const typeFieldSelect = typeField.find('SelectField');
    expect(typeFieldSelect.exists()).toBe(true);
    const typeFieldSelectProps = typeFieldSelect.props();
    expect(typeFieldSelectProps.value).toEqual(RuleType.PATTERN);

    const typeFieldSelectOptions = sortBy(Object.values(RuleType)).map(value => ({
      label: getRuleLabel(value),
      value,
    }));
    expect(typeFieldSelectProps.options).toEqual(typeFieldSelectOptions);

    // Regex matches Field
    const regexField = typeGroup.at(1);
    expect(regexField.find('FieldLabel').text()).toEqual('Regex matches');
    const regexFieldHelp = 'Custom regular expression (see documentation)';
    expect(regexField.find('QuestionTooltip').prop('title')).toEqual(regexFieldHelp);
    expect(regexField.find('Tooltip').prop('title')).toEqual(regexFieldHelp);

    if (rule.type === RuleType.PATTERN) {
      const regexFieldInput = regexField.find('input');
      expect(regexFieldInput.prop('value')).toEqual(rule.pattern);
    }

    // Event ID
    expect(wrapper.find('Toggle').text()).toEqual('Use event ID for auto-completion');

    // Source Field
    const sourceGroup = wrapper.find('SourceGroup');
    expect(sourceGroup.exists()).toBe(true);
    expect(sourceGroup.find('EventIdField')).toHaveLength(0);
    const sourceField = sourceGroup.find('Field');
    expect(sourceField.find('FieldLabel').text()).toEqual('Source');
    const sourceFieldHelp =
      'Where to look. In the simplest case this can be an attribute name.';
    expect(sourceField.find('QuestionTooltip').prop('title')).toEqual(sourceFieldHelp);
    expect(sourceField.find('Tooltip').prop('title')).toEqual(sourceFieldHelp);
    const sourceFieldInput = sourceField.find('input');
    expect(sourceFieldInput.prop('value')).toEqual(rule.source);

    // Close Modal
    const cancelButton = wrapper.find('[aria-label="Cancel"]').hostNodes();
    expect(cancelButton.exists()).toBe(true);
    cancelButton.simulate('click');

    // @ts-ignore
    await tick();
    wrapper.update();

    expect(wrapper.find('[data-test-id="modal-title"]')).toHaveLength(0);
  });

  it('edit Rule Modal', async () => {
    const wrapper = await renderComponent();

    // Method Field
    const methodField = wrapper.find('[data-test-id="method-field"]');
    const methodFieldInput = methodField.find('input').at(0);
    methodFieldInput.simulate('keyDown', {key: 'ArrowDown'});
    const methodFieldMenuOptions = wrapper.find(
      '[data-test-id="method-field"] MenuList Option Wrapper'
    );
    const maskOption = methodFieldMenuOptions.at(1);
    maskOption.simulate('click');

    // Placeholder Field should be now hidden
    const placeholderField = wrapper.find('[data-test-id="placeholder-field"]');
    expect(placeholderField).toHaveLength(0);

    // Type Field
    const typeField = wrapper.find('[data-test-id="type-field"]');
    const typeFieldInput = typeField.find('input').at(0);
    typeFieldInput.simulate('keyDown', {key: 'ArrowDown'});
    const typeFieldMenuOptions = wrapper.find(
      '[data-test-id="type-field"] MenuList Option Wrapper'
    );
    const anythingOption = typeFieldMenuOptions.at(0);
    anythingOption.simulate('click');

    // Regex Field should be now hidden
    const regexField = wrapper.find('[data-test-id="regex-field"]');
    expect(regexField).toHaveLength(0);

    // Source Field
    const sourceField = wrapper.find('[data-test-id="source-field"]');
    const sourceFieldInput = sourceField.find('input');
    sourceFieldInput.simulate('change', {target: {value: valueSuggestions[2].value}});

    // Save rule
    const saveButton = wrapper.find('[aria-label="Save Rule"]').hostNodes();
    expect(saveButton.exists()).toBe(true);
    saveButton.simulate('click');

    expect(submitRules).toHaveBeenCalled();
    expect(submitRules).toHaveBeenCalledWith(api, endpoint, [
      {
        id: 0,
        method: 'replace',
        type: 'password',
        source: 'password',
        placeholder: 'Scrubbed',
      },
      {id: 1, method: 'mask', type: 'creditcard', source: '$message'},
      {
        id: 2,
        method: 'mask',
        pattern: '',
        placeholder: '',
        type: 'anything',
        source: '$error.value',
      },
    ]);
  });
});
