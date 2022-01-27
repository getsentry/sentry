import {mountWithTheme} from 'sentry-test/enzyme';
import {getSelector, openMenu, selectByValue} from 'sentry-test/select-new';

import ModalActions from 'sentry/actions/modalActions';
import RuleNode from 'sentry/views/alerts/issueRuleEditor/ruleNode';

describe('RuleNode', function () {
  let project;
  let organization;
  let wrapper;
  const index = 0;
  const onDelete = jest.fn();
  // TODO: Test this function is being called correctly
  const onReset = jest.fn();
  const onPropertyChange = jest.fn();

  const simpleNode = {
    id: 'sentry.rules.simple_mock',
    label: '(mock) A new issue is created',
    enabled: true,
  };

  const formNode = label => ({
    label,
    id: 'sentry.rules.form_mock',
    enabled: true,
    formFields: {
      exampleStringField: {
        type: 'string',
        placeholder: 'placeholder',
      },
      exampleNumberField: {
        type: 'number',
        placeholder: 100,
      },
      exampleStringChoiceField: {
        type: 'choice',
        choices: [
          ['value1', 'label1'],
          ['value2', 'label2'],
          ['value3', 'label3'],
        ],
      },
      exampleNumberChoiceField: {
        type: 'choice',
        initial: 2,
        choices: [
          [1, 'label1'],
          [2, 'label2'],
          [3, 'label3'],
        ],
      },
      //   TODO: Add these fields and test if they implement correctly
      //   exampleMailActionField: {type: 'mailAction'},
      //   exampleAssigneeield: {type: 'assignee'},
    },
  });

  // TODO: Add this node and test if it implements correctly (e.g. Jira Tickets)
  // const ticketNode = {actionType: 'ticket'};

  const sentryAppNode = {
    id: 'sentry.rules.schema_form_mock',
    label: 'Configure SentryApp with these',
    enabled: true,
    actionType: 'sentryapp',
    sentryAppInstallationUuid: '1027',
    formFields: {
      exampleStringField: {
        type: 'string',
        placeholder: 'placeholder',
      },
      exampleNumberField: {
        type: 'number',
        placeholder: 100,
      },
      exampleStringChoiceField: {
        type: 'choice',
        choices: [
          ['value1', 'label1'],
          ['value2', 'label2'],
          ['value3', 'label3'],
        ],
      },
    },
  };

  const createWrapper = node => {
    project = TestStubs.Project();
    organization = TestStubs.Organization({projects: [project]});
    return mountWithTheme(
      <RuleNode
        index={index}
        node={node}
        data={{
          id: 'sentry.rules.mock',
          name: '(mock) A new issue is created',
        }}
        organization={organization}
        project={project}
        onDelete={onDelete}
        onPropertyChange={onPropertyChange}
        onReset={onReset}
      />
    );
  };

  const labelReplacer = (label, values) => {
    return label.replace(/{\w+}/gm, placeholder => values[placeholder]);
  };

  afterEach(function () {
    wrapper = undefined;
  });

  it('renders simple nodes', async function () {
    wrapper = createWrapper(simpleNode);
    expect(wrapper.text()).toEqual(simpleNode.label);
    expect(wrapper.find('button[aria-label="Delete Node"]').exists()).toEqual(true);
  });

  it('handles being deleted', async function () {
    wrapper = createWrapper(simpleNode);
    expect(wrapper.find('button[aria-label="Delete Node"]').exists()).toEqual(true);
    wrapper.find('button[aria-label="Delete Node"]').simulate('click');
    expect(onDelete).toHaveBeenCalledWith(index);
  });

  it('renders choice string choice fields correctly', async function () {
    const fieldName = 'exampleStringChoiceField';
    const label = `Here is a string choice field {${fieldName}}`;
    wrapper = createWrapper(formNode(label));

    // Should render the first option if no initial is provided
    await tick();
    expect(wrapper.text()).toEqual(labelReplacer(label, {[`{${fieldName}}`]: 'label1'}));

    selectByValue(wrapper, 'value3', {control: true, name: fieldName});
    expect(onPropertyChange).toHaveBeenCalledWith(index, fieldName, 'value3');
  });

  it('renders choice number choice fields correctly', async function () {
    const fieldName = 'exampleNumberChoiceField';
    const label = `Here is a number choice field {${fieldName}}`;
    wrapper = createWrapper(formNode(label));

    // Should render the initial value if one is provided
    await tick();
    expect(wrapper.text()).toEqual(labelReplacer(label, {[`{${fieldName}}`]: 'label2'}));

    const fieldOptions = {control: true, name: fieldName};
    openMenu(wrapper, fieldOptions);

    // Values for these dropdowns should exclusively be strings
    const numberValueOption = wrapper.find(
      `${getSelector(fieldOptions)} Option[value=2]`
    );
    const stringValueOption = wrapper.find(
      `${getSelector(fieldOptions)} Option[value="2"]`
    );
    expect(numberValueOption.exists()).toEqual(false);
    expect(stringValueOption.exists()).toEqual(true);

    selectByValue(wrapper, '3', fieldOptions);
    expect(onPropertyChange).toHaveBeenCalledWith(index, fieldName, '3');
  });

  it('renders number fields correctly', async function () {
    const fieldName = 'exampleNumberField';
    const label = `Here is a number field {${fieldName}}`;
    wrapper = createWrapper(formNode(label));

    const field = wrapper.find(`input[name="${fieldName}"]`);
    expect(field.prop('placeholder')).toEqual('100');

    field.simulate('change', {target: {value: '721'}});
    expect(onPropertyChange).toHaveBeenCalledWith(index, fieldName, '721');

    expect(wrapper.text()).toEqual(labelReplacer(label, {[`{${fieldName}}`]: ''}));
  });

  it('renders text fields correctly', async function () {
    const fieldName = 'exampleStringField';
    const label = `Here is a text field {${fieldName}}`;
    wrapper = createWrapper(formNode(label));

    const field = wrapper.find(`input[name="${fieldName}"]`);
    expect(field.prop('placeholder')).toEqual('placeholder');

    field.simulate('change', {target: {value: 'some text'}});
    expect(onPropertyChange).toHaveBeenCalledWith(index, fieldName, 'some text');

    expect(wrapper.text()).toEqual(labelReplacer(label, {[`{${fieldName}}`]: ''}));
  });

  it('renders mail action fields correctly', async function () {
    //   TODO
  });

  it('renders assignee fields correctly', async function () {
    //   TODO
  });

  it('renders ticket rules correctly', async function () {
    //   TODO
  });

  it('renders sentry apps with schema forms correctly', async function () {
    wrapper = createWrapper(sentryAppNode);
    const openModal = jest.spyOn(ModalActions, 'openModal');

    expect(wrapper.text()).toEqual(sentryAppNode.label + 'Settings');
    expect(wrapper.find('button[aria-label="Settings"]').exists()).toEqual(true);
    wrapper.find('button[aria-label="Settings"]').simulate('click');

    expect(openModal).toHaveBeenCalled();
  });
});
