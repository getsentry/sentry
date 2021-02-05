import React from 'react';
import styled from '@emotion/styled';

import {openModal} from 'app/actionCreators/modal';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import SelectControl from 'app/components/forms/selectControl';
import ExternalLink from 'app/components/links/externalLink';
import {IconDelete, IconSettings} from 'app/icons';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Choices, Organization, Project} from 'app/types';
import {
  AssigneeTargetType,
  IssueAlertRuleAction,
  IssueAlertRuleActionTemplate,
  IssueAlertRuleCondition,
  IssueAlertRuleConditionTemplate,
  MailActionTargetType,
} from 'app/types/alerts';
import Input from 'app/views/settings/components/forms/controls/input';

import MemberTeamFields from './memberTeamFields';
import TicketRuleModal from './ticketRuleModal';

export type FormField = {
  // Type of form fields
  type: string;
  // The rest is configuration for the form field
  [key: string]: any;
};

type Props = {
  index: number;
  node?: IssueAlertRuleActionTemplate | IssueAlertRuleConditionTemplate | null;
  data: IssueAlertRuleAction | IssueAlertRuleCondition;
  project: Project;
  organization: Organization;
  disabled: boolean;
  onDelete: (rowIndex: number) => void;
  onReset: (rowIndex: number, name: string, value: string) => void;
  onPropertyChange: (rowIndex: number, name: string, value: string) => void;
};

class RuleNode extends React.Component<Props> {
  handleDelete = () => {
    const {index, onDelete} = this.props;
    onDelete(index);
  };

  handleMemberTeamChange = (data: IssueAlertRuleAction | IssueAlertRuleCondition) => {
    const {index, onPropertyChange} = this.props;
    onPropertyChange(index, 'targetType', `${data.targetType}`);
    onPropertyChange(index, 'targetIdentifier', `${data.targetIdentifier}`);
  };

  getChoiceField = (name: string, fieldConfig: FormField) => {
    const {data, disabled, index, onPropertyChange, onReset} = this.props;

    // Select the first item on this list
    // If it's not yet defined, call onPropertyChange to make sure the value is set on state
    let initialVal;
    if (data) {
      if (data[name] === undefined && !!fieldConfig.choices.length) {
        if (fieldConfig.initial) {
          initialVal = fieldConfig.initial;
        } else {
          initialVal = fieldConfig.choices[0][0];
        }
      } else {
        initialVal = data[name];
      }
    }

    // Cast `key` to string, this problem pops up because of react-select v3 where
    // `value` requires the `option` object (e.g. {label, object}) - we have
    // helpers in `SelectControl` to filter `choices` to produce the value object
    //
    // However there are integrations that give the form field choices with the value as number, but
    // when the integration configuration gets saved, it gets saved and returned as a string
    const choices = fieldConfig.choices.map(([key, value]) => [`${key}`, value]);

    const handleChange = ({value}) => {
      if (fieldConfig.resetsForm) {
        onReset(index, name, value);
      } else {
        onPropertyChange(index, name, value);
      }
    };

    return (
      <InlineSelectControl
        isClearable={false}
        name={name}
        value={initialVal}
        styles={{
          control: provided => ({
            ...provided,
            minHeight: '28px',
            height: '28px',
          }),
        }}
        disabled={disabled}
        choices={choices}
        onChange={handleChange}
      />
    );
  };

  getTextField = (name: string, fieldConfig: FormField) => {
    const {data, index, onPropertyChange, disabled} = this.props;

    return (
      <InlineInput
        type="text"
        name={name}
        value={(data && data[name]) ?? ''}
        placeholder={`${fieldConfig.placeholder}`}
        disabled={disabled}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onPropertyChange(index, name, e.target.value)
        }
      />
    );
  };

  getNumberField = (name: string, fieldConfig: FormField) => {
    const {data, index, onPropertyChange, disabled} = this.props;

    return (
      <InlineNumberInput
        type="number"
        name={name}
        value={(data && data[name]) ?? ''}
        placeholder={`${fieldConfig.placeholder}`}
        disabled={disabled}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onPropertyChange(index, name, e.target.value)
        }
      />
    );
  };

  getMailActionFields = (_: string, __: FormField) => {
    const {data, organization, project, disabled} = this.props;
    const isInitialized =
      data?.targetType !== undefined && `${data.targetType}`.length > 0;
    return (
      <MemberTeamFields
        disabled={disabled}
        project={project}
        organization={organization}
        loading={!isInitialized}
        ruleData={data as IssueAlertRuleAction}
        onChange={this.handleMemberTeamChange}
        options={[
          {value: MailActionTargetType.IssueOwners, label: t('Issue Owners')},
          {value: MailActionTargetType.Team, label: t('Team')},
          {value: MailActionTargetType.Member, label: t('Member')},
        ]}
        memberValue={MailActionTargetType.Member}
        teamValue={MailActionTargetType.Team}
      />
    );
  };

  getAssigneeFilterFields = (_: string, __: FormField) => {
    const {data, organization, project, disabled} = this.props;
    const isInitialized =
      data?.targetType !== undefined && `${data.targetType}`.length > 0;
    return (
      <MemberTeamFields
        disabled={disabled}
        project={project}
        organization={organization}
        loading={!isInitialized}
        ruleData={data as IssueAlertRuleCondition}
        onChange={this.handleMemberTeamChange}
        options={[
          {value: AssigneeTargetType.Unassigned, label: t('No One')},
          {value: AssigneeTargetType.Team, label: t('Team')},
          {value: AssigneeTargetType.Member, label: t('Member')},
        ]}
        memberValue={AssigneeTargetType.Member}
        teamValue={AssigneeTargetType.Team}
      />
    );
  };

  getField = (name: string, fieldConfig: FormField) => {
    const getFieldTypes = {
      choice: this.getChoiceField,
      number: this.getNumberField,
      string: this.getTextField,
      mailAction: this.getMailActionFields,
      assignee: this.getAssigneeFilterFields,
    };
    return getFieldTypes[fieldConfig.type](name, fieldConfig);
  };

  renderRow() {
    const {data, node} = this.props;

    if (!node) {
      return (
        <Separator>
          This node failed to render. It may have migrated to another section of the alert
          conditions
        </Separator>
      );
    }

    const {label, formFields} = node;

    const parts = label.split(/({\w+})/).map((part, i) => {
      if (!/^{\w+}$/.test(part)) {
        return <Separator key={i}>{part}</Separator>;
      }

      const key = part.slice(1, -1);

      // If matcher is "is set" or "is not set", then we do not want to show the value input
      // because it is not required
      if (key === 'value' && data && (data.match === 'is' || data.match === 'ns')) {
        return null;
      }
      return (
        <Separator key={key}>
          {formFields && formFields.hasOwnProperty(key)
            ? this.getField(key, formFields[key])
            : part}
        </Separator>
      );
    });

    const [title, ...inputs] = parts;

    // We return this so that it can be a grid
    return (
      <React.Fragment>
        {title}
        {inputs}
      </React.Fragment>
    );
  }

  conditionallyRenderHelpfulBanner() {
    const {data, project, organization} = this.props;
    /**
     * Would prefer to check if data is of `IssueAlertRuleAction` type, however we can't do typechecking at runtime as
     * user defined types are erased through transpilation.
     * Instead, we apply duck typing semantics here.
     * See: https://stackoverflow.com/questions/51528780/typescript-check-typeof-against-custom-type
     */
    if (!data?.targetType || data.id !== 'sentry.mail.actions.NotifyEmailAction') {
      return null;
    }

    switch (data.targetType) {
      case MailActionTargetType.IssueOwners:
        return (
          <MarginlessAlert type="warning">
            {tct(
              'If there are no matching [issueOwners], ownership is determined by the [ownershipSettings].',
              {
                issueOwners: (
                  <ExternalLink href="https://docs.sentry.io/workflow/issue-owners/">
                    {t('issue owners')}
                  </ExternalLink>
                ),
                ownershipSettings: (
                  <ExternalLink
                    href={`/settings/${organization.slug}/projects/${project.slug}/ownership/`}
                  >
                    {t('ownership settings')}
                  </ExternalLink>
                ),
              }
            )}
          </MarginlessAlert>
        );
      case MailActionTargetType.Team:
        return null;
      case MailActionTargetType.Member:
        return null;
      default:
        return null;
    }
  }

  /**
   * Update all the AlertRuleAction's fields from the TicketRuleModal together
   * only after the user clicks "Apply Changes".
   * @param formData Form data
   * @param fetchedFieldOptionsCache Object
   */
  updateParent = (
    formData: {[key: string]: string},
    fetchedFieldOptionsCache: Record<string, Choices>
  ): void => {
    const {index, onPropertyChange} = this.props;

    // We only know the choices after the form loads.
    formData.dynamic_form_fields = ((formData.dynamic_form_fields as any) || []).map(
      field => {
        // Overwrite the choices because the user's pick is in this list.
        if (
          field.name in formData &&
          fetchedFieldOptionsCache?.hasOwnProperty(field.name)
        ) {
          field.choices = fetchedFieldOptionsCache[field.name];
        }
        return field;
      }
    );

    for (const [name, value] of Object.entries(formData)) {
      onPropertyChange(index, name, value);
    }
  };

  render() {
    const {data, disabled, index, node, organization} = this.props;
    const ticketRule = node?.hasOwnProperty('actionType');
    return (
      <RuleRowContainer>
        <RuleRow>
          <Rule>
            {data && <input type="hidden" name="id" value={data.id} />}
            {this.renderRow()}
            {ticketRule && node && (
              <Button
                size="small"
                icon={<IconSettings size="xs" />}
                type="button"
                onClick={() =>
                  openModal(deps => (
                    <TicketRuleModal
                      {...deps}
                      formFields={node.formFields || {}}
                      link={node.link}
                      ticketType={node.ticketType}
                      instance={data}
                      index={index}
                      onSubmitAction={this.updateParent}
                      organization={organization}
                    />
                  ))
                }
              >
                {t('Issue Link Settings')}
              </Button>
            )}
          </Rule>
          <DeleteButton
            disabled={disabled}
            label={t('Delete Node')}
            onClick={this.handleDelete}
            type="button"
            size="small"
            icon={<IconDelete />}
          />
        </RuleRow>
        {this.conditionallyRenderHelpfulBanner()}
      </RuleRowContainer>
    );
  }
}

export default RuleNode;

const InlineInput = styled(Input)`
  width: auto;
  height: 28px;
`;

const InlineNumberInput = styled(Input)`
  width: 90px;
  height: 28px;
`;

const InlineSelectControl = styled(SelectControl)`
  width: 180px;
`;

const Separator = styled('span')`
  margin-right: ${space(1)};
  padding-top: ${space(0.5)};
  padding-bottom: ${space(0.5)};
`;

const RuleRow = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(1)};
`;

const RuleRowContainer = styled('div')`
  background-color: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px ${p => p.theme.innerBorder} solid;
`;

const Rule = styled('div')`
  display: flex;
  align-items: center;
  flex: 1;
  flex-wrap: wrap;
`;

const DeleteButton = styled(Button)`
  flex-shrink: 0;
`;

const MarginlessAlert = styled(Alert)`
  margin: 0;
`;
