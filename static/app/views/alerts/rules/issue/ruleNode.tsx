import {Fragment, useCallback, useEffect} from 'react';
import styled from '@emotion/styled';
import merge from 'lodash/merge';

import {openModal} from 'sentry/actionCreators/modal';
import {Button, LinkButton} from 'sentry/components/button';
import {Alert} from 'sentry/components/core/alert';
import {Input} from 'sentry/components/core/input';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import ExternalLink from 'sentry/components/links/externalLink';
import NumberInput from 'sentry/components/numberInput';
import {releaseHealth} from 'sentry/data/platformCategories';
import {IconDelete, IconSettings} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {
  IssueAlertConfiguration,
  IssueAlertRuleAction,
  IssueAlertRuleCondition,
} from 'sentry/types/alerts';
import {
  AssigneeTargetType,
  IssueAlertActionType,
  IssueAlertConditionType,
  IssueAlertFilterType,
  MailActionTargetType,
} from 'sentry/types/alerts';
import type {Choices} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import MemberTeamFields from 'sentry/views/alerts/rules/issue/memberTeamFields';
import SentryAppRuleModal from 'sentry/views/alerts/rules/issue/sentryAppRuleModal';
import TicketRuleModal from 'sentry/views/alerts/rules/issue/ticketRuleModal';

interface FieldProps {
  data: Props['data'];
  disabled: boolean;
  fieldConfig: FormField;
  index: number;
  name: string;
  onMemberTeamChange: (data: Props['data']) => void;
  onPropertyChange: Props['onPropertyChange'];
  onReset: Props['onReset'];
  organization: Organization;
  project: Project;
}

function NumberField({
  data,
  index,
  disabled,
  name,
  fieldConfig,
  onPropertyChange,
}: FieldProps) {
  const value =
    (data[name] && typeof data[name] !== 'boolean') || data[name] === 0
      ? Number(data[name])
      : NaN;

  // Set default value of number fields to the placeholder value
  useEffect(() => {
    if (
      data.id === IssueAlertFilterType.ISSUE_OCCURRENCES &&
      isNaN(value) &&
      !isNaN(Number(fieldConfig.placeholder))
    ) {
      onPropertyChange(index, name, `${fieldConfig.placeholder}`);
    }
    // Value omitted on purpose to avoid overwriting user changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPropertyChange, index, name, fieldConfig.placeholder, data.id]);

  return (
    <InlineNumberInput
      min={0}
      name={name}
      value={value}
      placeholder={`${fieldConfig.placeholder}`}
      disabled={disabled}
      onChange={newVal => onPropertyChange(index, name, String(newVal))}
      aria-label={t('Value')}
    />
  );
}

function AssigneeFilterFields({
  data,
  organization,
  project,
  disabled,
  onMemberTeamChange,
}: FieldProps) {
  const isInitialized = data.targetType !== undefined && `${data.targetType}`.length > 0;
  return (
    <MemberTeamFields
      disabled={disabled}
      project={project}
      organization={organization}
      loading={!isInitialized}
      ruleData={data}
      onChange={onMemberTeamChange}
      options={[
        {value: AssigneeTargetType.UNASSIGNED, label: t('No One')},
        {value: AssigneeTargetType.TEAM, label: t('Team')},
        {value: AssigneeTargetType.MEMBER, label: t('Member')},
      ]}
      memberValue={AssigneeTargetType.MEMBER}
      teamValue={AssigneeTargetType.TEAM}
    />
  );
}

function MailActionFields({
  data,
  organization,
  project,
  disabled,
  onMemberTeamChange,
}: FieldProps) {
  const isInitialized = data.targetType !== undefined && `${data.targetType}`.length > 0;
  const issueOwnersLabel = t('Suggested Assignees');
  return (
    <MemberTeamFields
      disabled={disabled}
      project={project}
      organization={organization}
      loading={!isInitialized}
      ruleData={data as IssueAlertRuleAction}
      onChange={onMemberTeamChange}
      options={[
        {value: MailActionTargetType.ISSUE_OWNERS, label: issueOwnersLabel},
        {value: MailActionTargetType.TEAM, label: t('Team')},
        {value: MailActionTargetType.MEMBER, label: t('Member')},
      ]}
      memberValue={MailActionTargetType.MEMBER}
      teamValue={MailActionTargetType.TEAM}
    />
  );
}

function ChoiceField({
  data,
  disabled,
  index,
  onPropertyChange,
  onReset,
  name,
  fieldConfig,
}: FieldProps) {
  // Select the first item on this list
  // If it's not yet defined, call onPropertyChange to make sure the value is set on state
  let initialVal: string | undefined;
  if (data[name] === undefined && !!fieldConfig.choices.length) {
    initialVal = fieldConfig.initial
      ? `${fieldConfig.initial}`
      : `${fieldConfig.choices[0][0]}`;
  } else {
    initialVal = `${data[name]}`;
  }

  // All `value`s are cast to string
  // There are integrations that give the form field choices with the value as number, but
  // when the integration configuration gets saved, it gets saved and returned as a string
  // @ts-expect-error TS(7031): Binding element 'value' implicitly has an 'any' ty... Remove this comment to see the full error message
  const options = fieldConfig.choices.map(([value, label]) => ({
    value: `${value}`,
    label,
  }));

  return (
    <InlineSelectControl
      isClearable={false}
      name={name}
      value={initialVal}
      styles={{
        control: (provided: any) => ({
          ...provided,
          minHeight: '28px',
          height: '28px',
        }),
      }}
      disabled={disabled}
      options={options}
      onChange={({value}: {value: string}) => {
        if (fieldConfig.resetsForm) {
          onReset(index, name, value);
        } else {
          onPropertyChange(index, name, value);
        }
      }}
    />
  );
}

function TextField({
  data,
  index,
  onPropertyChange,
  disabled,
  name,
  fieldConfig,
}: FieldProps) {
  const value =
    data[name] && typeof data[name] !== 'boolean' ? (data[name] as string | number) : '';

  return (
    <InlineInput
      type="text"
      name={name}
      value={value}
      placeholder={`${fieldConfig.placeholder}`}
      disabled={disabled}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
        onPropertyChange(index, name, e.target.value)
      }
    />
  );
}

export type FormField = {
  // The rest is configuration for the form field
  [key: string]: any;
  // Type of form fields
  type: string;
};

interface Props {
  data: IssueAlertRuleAction | IssueAlertRuleCondition;
  disabled: boolean;
  index: number;
  onDelete: (rowIndex: number) => void;
  onPropertyChange: (rowIndex: number, name: string, value: string) => void;
  onReset: (rowIndex: number, name: string, value: string) => void;
  organization: Organization;
  project: Project;
  incompatibleBanner?: boolean;
  incompatibleRule?: boolean;
  node?: IssueAlertConfiguration[keyof IssueAlertConfiguration][number] | null;
}

function RuleNode({
  index,
  data,
  node,
  organization,
  project,
  disabled,
  onDelete,
  onPropertyChange,
  onReset,
  incompatibleRule,
  incompatibleBanner,
}: Props) {
  const handleDelete = useCallback(() => {
    onDelete(index);
  }, [index, onDelete]);

  const handleMemberTeamChange = useCallback(
    ({targetType, targetIdentifier}: IssueAlertRuleAction | IssueAlertRuleCondition) => {
      onPropertyChange(index, 'targetType', `${targetType}`);
      onPropertyChange(index, 'targetIdentifier', `${targetIdentifier}`);
    },
    [index, onPropertyChange]
  );

  function getField(name: string, fieldConfig: FormField) {
    const fieldProps: FieldProps = {
      index,
      name,
      fieldConfig,
      data,
      organization,
      project,
      disabled,
      onMemberTeamChange: handleMemberTeamChange,
      onPropertyChange,
      onReset,
    };

    if (name === 'environment') {
      return (
        <ChoiceField
          {...merge(fieldProps, {
            fieldConfig: {choices: project.environments.map(env => [env, env])},
          })}
        />
      );
    }

    switch (fieldConfig.type) {
      case 'choice':
        return <ChoiceField {...fieldProps} />;
      case 'number':
        return <NumberField {...fieldProps} />;
      case 'string':
        return <TextField {...fieldProps} />;
      case 'mailAction':
        return <MailActionFields {...fieldProps} />;
      case 'assignee':
        return <AssigneeFilterFields {...fieldProps} />;
      default:
        return null;
    }
  }

  function renderRow() {
    if (!node) {
      return (
        <Separator>
          This node failed to render. It may have migrated to another section of the alert
          conditions
        </Separator>
      );
    }

    let {label} = node;

    if (
      data.id === IssueAlertActionType.NOTIFY_EMAIL &&
      data.targetType !== MailActionTargetType.ISSUE_OWNERS
    ) {
      // Hide the fallback options when targeting team or member
      label = 'Send a notification to {targetType}';
    }

    if (data.id === IssueAlertConditionType.REAPPEARED_EVENT) {
      label = t('The issue changes state from archived to escalating');
    }

    const parts = label.split(/({\w+})/).map((part, i) => {
      if (!/^{\w+}$/.test(part)) {
        return <Separator key={i}>{part}</Separator>;
      }

      const key = part.slice(1, -1);

      // If matcher is "is set" or "is not set", then we do not want to show the value input
      // because it is not required
      if (key === 'value' && (data.match === 'is' || data.match === 'ns')) {
        return null;
      }
      return (
        <Separator key={key}>
          {node.formFields?.hasOwnProperty(key)
            ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              getField(key, node.formFields[key])
            : part}
        </Separator>
      );
    });

    const [title, ...inputs] = parts;

    // We return this so that it can be a grid
    return (
      <Fragment>
        {title}
        {inputs}
      </Fragment>
    );
  }

  /**
   * Displays a button to open a custom modal for sentry apps or ticket integrations
   */
  function renderIntegrationButton() {
    if (!node || !('actionType' in node)) {
      return null;
    }

    if (node.actionType === 'ticket') {
      return (
        <Button
          size="sm"
          icon={<IconSettings />}
          onClick={() =>
            openModal(deps => (
              <TicketRuleModal
                {...deps}
                formFields={node.formFields || {}}
                link={node.link}
                ticketType={node.ticketType}
                instance={data}
                index={index}
                onSubmitAction={updateParentFromTicketRule}
                organization={organization}
              />
            ))
          }
        >
          {t('Issue Link Settings')}
        </Button>
      );
    }

    if (node.actionType === 'sentryapp' && node.sentryAppInstallationUuid) {
      return (
        <Button
          size="sm"
          icon={<IconSettings />}
          disabled={Boolean(data.disabled) || disabled}
          onClick={() => {
            openModal(
              deps => (
                <SentryAppRuleModal
                  {...deps}
                  sentryAppInstallationUuid={node.sentryAppInstallationUuid}
                  config={node.formFields}
                  appName={node.prompt ?? node.label}
                  onSubmitSuccess={updateParentFromSentryAppRule}
                  resetValues={data}
                />
              ),
              {closeEvents: 'escape-key'}
            );
          }}
        >
          {t('Settings')}
        </Button>
      );
    }

    return null;
  }

  function conditionallyRenderHelpfulBanner() {
    if (data.id === IssueAlertConditionType.EVENT_FREQUENCY_PERCENT) {
      if (!project.platform || !releaseHealth.includes(project.platform)) {
        return (
          <MarginlessAlert type="error">
            {tct(
              "This project doesn't support sessions. [link:View supported platforms]",
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/releases/setup/#release-health" />
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

    if (data.id === IssueAlertActionType.SLACK) {
      return (
        <MarginlessAlert
          type="info"
          showIcon
          trailingItems={
            <LinkButton
              href="https://docs.sentry.io/product/integrations/notification-incidents/slack/#rate-limiting-error"
              external
              size="xs"
            >
              {t('Learn More')}
            </LinkButton>
          }
        >
          {t('Having rate limiting problems? Enter a channel or user ID.')}
        </MarginlessAlert>
      );
    }

    if (data.id === IssueAlertActionType.DISCORD) {
      return (
        <MarginlessAlert
          type="info"
          showIcon
          trailingItems={
            <LinkButton
              href="https://docs.sentry.io/product/accounts/early-adopter-features/discord/#issue-alerts"
              external
              size="xs"
            >
              {t('Learn More')}
            </LinkButton>
          }
        >
          {t('Note that you must enter a Discord channel ID, not a channel name.')}
        </MarginlessAlert>
      );
    }

    return null;
  }

  function renderIncompatibleRuleBanner() {
    if (!incompatibleBanner) {
      return null;
    }
    return (
      <MarginlessAlert type="error" showIcon>
        {t(
          'The conditions highlighted in red are in conflict. They may prevent the alert from ever being triggered.'
        )}
      </MarginlessAlert>
    );
  }

  /**
   * Update all the AlertRuleAction's fields from the TicketRuleModal together
   * only after the user clicks "Apply Changes".
   * @param formData Form data
   * @param fetchedFieldOptionsCache Object
   */
  const updateParentFromTicketRule = useCallback(
    (
      formData: Record<string, string>,
      fetchedFieldOptionsCache: Record<string, Choices>
    ): void => {
      // We only know the choices after the form loads.
      formData.dynamic_form_fields = ((formData.dynamic_form_fields as any) || []).map(
        (field: any) => {
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
    },
    [index, onPropertyChange]
  );

  /**
   * Update all the AlertRuleAction's fields from the SentryAppRuleModal together
   * only after the user clicks "Save Changes".
   * @param formData Form data
   */
  const updateParentFromSentryAppRule = useCallback(
    (formData: Record<string, string>): void => {
      for (const [name, value] of Object.entries(formData)) {
        onPropertyChange(index, name, value);
      }
    },
    [index, onPropertyChange]
  );

  return (
    <RuleRowContainer incompatible={incompatibleRule}>
      <RuleRow>
        <Rule>
          <input type="hidden" name="id" value={data.id} />
          {renderRow()}
          {renderIntegrationButton()}
        </Rule>
        <DeleteButton
          disabled={disabled}
          aria-label={t('Delete Node')}
          onClick={handleDelete}
          size="sm"
          icon={<IconDelete />}
        />
      </RuleRow>
      {renderIncompatibleRuleBanner()}
      {conditionallyRenderHelpfulBanner()}
    </RuleRowContainer>
  );
}

export default RuleNode;

const InlineInput = styled(Input)`
  width: auto;
  height: 28px;
  min-height: 28px;
`;

const InlineNumberInput = styled(NumberInput)`
  width: 90px;
  height: 28px;
  min-height: 28px;
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

const RuleRowContainer = styled('div')<{incompatible?: boolean}>`
  background-color: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px ${p => p.theme.innerBorder} solid;
  border-color: ${p => (p.incompatible ? p.theme.red200 : 'none')};
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
  padding: ${space(1)} ${space(1)};
`;
