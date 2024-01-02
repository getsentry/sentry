import selectEvent from 'react-select-event';
import {Organization} from 'sentry-fixture/organization';
import {Project as ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ModalStore from 'sentry/stores/modalStore';
import RuleNode from 'sentry/views/alerts/rules/issue/ruleNode';

describe('RuleNode', () => {
  const project = ProjectFixture();
  const organization = Organization({projects: [project]});
  const index = 0;
  const onDelete = jest.fn();
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
      exampleResetStringChoiceField: {
        type: 'choice',
        choices: [
          ['value1', 'label1'],
          ['value2', 'label2'],
          ['value3', 'label3'],
        ],
        resetsForm: true,
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
      exampleMailActionField: {
        type: 'mailAction',
        choices: [
          ['IssueOwners', 'Issue Owners'],
          ['Team', 'Team'],
          ['Member', 'Member'],
        ],
      },
      exampleAssigneeField: {
        type: 'assignee',
        choices: [
          ['Unassigned', 'Unassigned'],
          ['Team', 'Team'],
          ['Member', 'Member'],
        ],
      },
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

  const renderRuleNode = (node, data = {}, org = organization) => {
    return render(
      <RuleNode
        index={index}
        node={node}
        data={{
          id: 'sentry.rules.mock',
          name: '(mock) A new issue is created',
          label: '(mock) A new issue is created',
          prompt: '',
          ...data,
        }}
        disabled={false}
        organization={org}
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

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('handles being deleted', async () => {
    renderRuleNode(simpleNode);
    expect(screen.getByText(simpleNode.label)).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Delete Node'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Delete Node'}));
    expect(onDelete).toHaveBeenCalledWith(index);
  });

  it('renders choice string choice fields correctly', async () => {
    const fieldName = 'exampleStringChoiceField';
    const label = `Here is a string choice field {${fieldName}}`;
    renderRuleNode(formNode(label));

    // Should render the first option if no initial is provided
    expect(
      screen.getByText('Here is a string choice field').parentElement
    ).toHaveTextContent(labelReplacer(label, {[`{${fieldName}}`]: 'label1'}));

    await selectEvent.select(screen.getByText('label1'), 'label3');
    expect(onPropertyChange).toHaveBeenCalledWith(index, fieldName, 'value3');
  });

  it('resets choice fields with resetsForm', async () => {
    const fieldName = 'exampleResetStringChoiceField';
    const label = `Here is a string reset choice field {${fieldName}}`;
    renderRuleNode(formNode(label));

    // Should render the first option if no initial is provided
    expect(screen.getByText('Here is a string reset choice field')).toBeInTheDocument();

    await selectEvent.select(screen.getByText('label1'), 'label3');
    expect(onReset).toHaveBeenCalledWith(index, fieldName, 'value3');
  });

  it('renders choice number choice fields correctly', async () => {
    const fieldName = 'exampleNumberChoiceField';
    const label = `Here is a number choice field {${fieldName}}`;
    renderRuleNode(formNode(label));

    // Should render the initial value if one is provided
    expect(
      screen.getByText('Here is a number choice field').parentElement
    ).toHaveTextContent(labelReplacer(label, {[`{${fieldName}}`]: 'label2'}));

    selectEvent.openMenu(screen.getByText('label2'));

    await userEvent.click(screen.getByText('label3'));
    expect(onPropertyChange).toHaveBeenCalledWith(index, fieldName, '3');
  });

  it('renders number fields correctly', async () => {
    const fieldName = 'exampleNumberField';
    const label = `Here is a number field {${fieldName}}`;
    renderRuleNode(formNode(label));

    expect(screen.getByText('Here is a number field')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('100')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText('100'), '721');
    await userEvent.click(document.body);
    expect(onPropertyChange).toHaveBeenCalledWith(index, fieldName, '721');
  });

  it('sets some number fields by default', () => {
    const fieldName = 'exampleNumberField';
    const label = `Here is a number field {${fieldName}}`;
    renderRuleNode(formNode(label), {
      id: 'sentry.rules.filters.issue_occurrences.IssueOccurrencesFilter',
    });

    expect(onPropertyChange).toHaveBeenCalledTimes(1);
    expect(onPropertyChange).toHaveBeenCalledWith(index, fieldName, '100');
  });

  it('renders text fields correctly', async () => {
    const fieldName = 'exampleStringField';
    const label = `Here is a text field {${fieldName}}`;
    renderRuleNode(formNode(label));

    expect(screen.getByText('Here is a text field')).toBeInTheDocument();
    const input = screen.getByPlaceholderText('placeholder');
    expect(input).toBeInTheDocument();

    await userEvent.click(input);
    await userEvent.paste('some text');
    expect(onPropertyChange).toHaveBeenCalledWith(index, fieldName, 'some text');
  });

  it('renders sentry apps with schema forms correctly', async () => {
    renderRuleNode(sentryAppNode);
    const openModal = jest.spyOn(ModalStore, 'openModal');

    expect(screen.getByText(sentryAppNode.label)).toBeInTheDocument();
    const settingsButton = screen.getByLabelText('Settings');
    expect(settingsButton).toBeInTheDocument();
    await userEvent.click(settingsButton);

    expect(openModal).toHaveBeenCalled();
  });

  it('renders mail action field', async () => {
    const fieldName = 'exampleMailActionField';
    const label = `Send a notification to {${fieldName}}`;
    renderRuleNode(formNode(label), {targetType: 'IssueOwners'});

    expect(screen.getByText('Send a notification to')).toBeInTheDocument();
    await selectEvent.select(screen.getByText('Issue Owners'), 'Team');
    expect(onPropertyChange).toHaveBeenCalledTimes(2);
    expect(onPropertyChange).toHaveBeenCalledWith(index, 'targetType', 'Team');
    expect(onPropertyChange).toHaveBeenCalledWith(index, 'targetIdentifier', '');
  });

  it('renders mail action field with suggested assignees', async () => {
    const fieldName = 'exampleMailActionField';
    const label = `Send a notification to {${fieldName}}`;
    const organizationWithFeat = {
      ...organization,
      features: ['streamline-targeting-context'],
    };
    renderRuleNode(formNode(label), {targetType: 'IssueOwners'}, organizationWithFeat);

    expect(screen.getByText('Send a notification to')).toBeInTheDocument();
    await selectEvent.select(screen.getByText('Suggested Assignees'), 'Team');
  });

  it('renders assignee field', async () => {
    const fieldName = 'exampleAssigneeField';
    const label = `The issue is assigned to {${fieldName}}`;
    renderRuleNode(formNode(label), {targetType: 'Unassigned'});

    expect(screen.getByText('The issue is assigned to')).toBeInTheDocument();
    await selectEvent.select(screen.getByText('No One'), 'Team');
    expect(onPropertyChange).toHaveBeenCalledTimes(2);
    expect(onPropertyChange).toHaveBeenCalledWith(index, 'targetType', 'Team');
    expect(onPropertyChange).toHaveBeenCalledWith(index, 'targetIdentifier', '');
  });
});
