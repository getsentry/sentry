import * as React from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import FeatureBadge from 'sentry/components/featureBadge';
import Input from 'sentry/components/forms/controls/input';
import SelectControl from 'sentry/components/forms/selectControl';
import ExternalLink from 'sentry/components/links/externalLink';
import {releaseHealth} from 'sentry/data/platformCategories';
import {IconDelete, IconSettings} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Choices, Organization, Project} from 'sentry/types';
import {
  AssigneeTargetType,
  IssueAlertRuleAction,
  IssueAlertRuleActionTemplate,
  IssueAlertRuleCondition,
  IssueAlertRuleConditionTemplate,
  MailActionTargetType,
} from 'sentry/types/alerts';
import MemberTeamFields from 'sentry/views/alerts/issueRuleEditor/memberTeamFields';
import SentryAppRuleModal from 'sentry/views/alerts/issueRuleEditor/sentryAppRuleModal';
import TicketRuleModal from 'sentry/views/alerts/issueRuleEditor/ticketRuleModal';
import {SchemaFormConfig} from 'sentry/views/organizationIntegrations/sentryAppExternalForm';
import {EVENT_FREQUENCY_PERCENT_CONDITION} from 'sentry/views/projectInstall/issueAlertOptions';

export type FormField = {
  // The rest is configuration for the form field
  [key: string]: any;
  // Type of form fields
  type: string;
};

type Props = {
  data: IssueAlertRuleAction | IssueAlertRuleCondition;
  disabled: boolean;
  index: number;
  onDelete: (rowIndex: number) => void;
  onPropertyChange: (rowIndex: number, name: string, value: string) => void;
  onReset: (rowIndex: number, name: string, value: string) => void;
  organization: Organization;
  project: Project;
  node?: IssueAlertRuleActionTemplate | IssueAlertRuleConditionTemplate | null;
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
        initialVal = fieldConfig.initial
          ? `${fieldConfig.initial}`
          : `${fieldConfig.choices[0][0]}`;
      } else {
        initialVal = `${data[name]}`;
      }
    }

    // All `value`s are cast to string
    // There are integrations that give the form field choices with the value as number, but
    // when the integration configuration gets saved, it gets saved and returned as a string
    const options = fieldConfig.choices.map(([value, label]) => ({
      value: `${value}`,
      label,
    }));

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
        options={options}
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

    if (data.id === EVENT_FREQUENCY_PERCENT_CONDITION) {
      if (!project.platform || !releaseHealth.includes(project.platform)) {
        return (
          <MarginlessAlert type="error">
            {tct(
              "This project doesn't support sessions. [link:View supported platforms]",
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/releases/health/setup/" />
                ),
              }
            )}
          </MarginlessAlert>
        );
      }

      return (
        <MarginlessAlert type="warning">
          {tct(
            'Percent of sessions affected is approximated by the ratio of the issue frequency to the number of sessions in the project. [link:Learn more.]',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/alerts/create-alerts/issue-alert-config/" />
              ),
            }
          )}
        </MarginlessAlert>
      );
    }
    if (data.id === 'sentry.integrations.slack.notify_action.SlackNotifyServiceAction') {
      return (
        <MarginlessAlert type="warning">
          {tct(
            'Having rate limiting problems? Enter a channel or user ID. Read more [rateLimiting].',
            {
              rateLimiting: (
                <ExternalLink href="https://docs.sentry.io/product/integrations/notification-incidents/slack/#rate-limiting-error">
                  {t('here')}
                </ExternalLink>
              ),
            }
          )}
        </MarginlessAlert>
      );
    }
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
                  <ExternalLink href="https://docs.sentry.io/product/error-monitoring/issue-owners/">
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
  updateParentFromTicketRule = (
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

  /**
   * Update all the AlertRuleAction's fields from the SentryAppRuleModal together
   * only after the user clicks "Save Changes".
   * @param formData Form data
   */
  updateParentFromSentryAppRule = (formData: {[key: string]: string}): void => {
    const {index, onPropertyChange} = this.props;

    for (const [name, value] of Object.entries(formData)) {
      onPropertyChange(index, name, value);
    }
  };

  isSchemaConfig(
    formFields: IssueAlertRuleActionTemplate['formFields']
  ): formFields is SchemaFormConfig {
    return !formFields ? false : (formFields as SchemaFormConfig).uri !== undefined;
  }

  render() {
    const {data, disabled, index, node, organization} = this.props;
    const {actionType, id, sentryAppInstallationUuid} = node || {};
    const ticketRule = actionType === 'ticket';
    const sentryAppRule = actionType === 'sentryapp' && sentryAppInstallationUuid;
    const isNew = id === EVENT_FREQUENCY_PERCENT_CONDITION;
    return (
      <RuleRowContainer>
        <RuleRow>
          <Rule>
            {isNew && <StyledFeatureBadge type="new" />}
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
                      onSubmitAction={this.updateParentFromTicketRule}
                      organization={organization}
                    />
                  ))
                }
              >
                {t('Issue Link Settings')}
              </Button>
            )}
            {sentryAppRule && node && (
              <Button
                size="small"
                icon={<IconSettings size="xs" />}
                type="button"
                onClick={() => {
                  openModal(
                    deps => (
                      <SentryAppRuleModal
                        {...deps}
                        sentryAppInstallationUuid={sentryAppInstallationUuid}
                        config={node.formFields as SchemaFormConfig}
                        appName={node.prompt}
                        onSubmitSuccess={this.updateParentFromSentryAppRule}
                        resetValues={data}
                      />
                    ),
                    {allowClickClose: false}
                  );
                }}
              >
                {t('Settings')}
              </Button>
            )}
          </Rule>
          <DeleteButton
            disabled={disabled}
            aria-label={t('Delete Node')}
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
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  border-width: 0;
  border-top: 1px ${p => p.theme.innerBorder} solid;
  margin: 0;
  padding: ${space(1)} ${space(1)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledFeatureBadge = styled(FeatureBadge)`
  margin: 0 ${space(1)} 0 0;
`;
