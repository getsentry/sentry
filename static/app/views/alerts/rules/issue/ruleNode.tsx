import {Fragment, useCallback, useEffect} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Input, NumberInput} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Select} from '@sentry/scraps/select';

import {openModal} from 'sentry/actionCreators/modal';
import type {JsonFormAdapterFieldConfig} from 'sentry/components/backendJsonFormAdapter/types';
import {transformChoices} from 'sentry/components/backendJsonFormAdapter/utils';
import {TicketRuleModal} from 'sentry/components/externalIssues/ticketRuleModal';
import {releaseHealth} from 'sentry/data/platformCategories';
import {IconDelete, IconSettings} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {
  IssueAlertRuleAction,
  IssueAlertRuleActionTemplate,
  IssueAlertRuleCondition,
  IssueAlertRuleFormField,
  TicketActionData,
} from 'sentry/types/alerts';
import {
  AssigneeTargetType,
  IssueAlertActionType,
  IssueAlertConditionType,
  IssueAlertFilterType,
  MailActionTargetType,
} from 'sentry/types/alerts';
import type {Choices} from 'sentry/types/core';
import type {IssueCategory} from 'sentry/types/group';
import {VALID_ISSUE_CATEGORIES} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {MemberTeamFields} from 'sentry/views/alerts/rules/issue/memberTeamFields';
import {SentryAppRuleModal} from 'sentry/views/alerts/rules/issue/sentryAppRuleModal';
import type {SchemaFormConfig} from 'sentry/views/settings/organizationIntegrations/sentryAppExternalForm';

interface FieldProps {
  data: Props['data'];
  disabled: boolean;
  index: number;
  name: string;
  onMemberTeamChange: (data: Props['data']) => void;
  onPropertyChange: Props['onPropertyChange'];
  onReset: Props['onReset'];
  organization: Organization;
  project: Project;
}

/**
 * Maps a backend alert rule form field to the JsonFormAdapterFieldConfig shape.
 */
function mapAlertRuleField(
  name: string,
  field: IssueAlertRuleFormField
): JsonFormAdapterFieldConfig {
  switch (field.type) {
    case 'choice':
      return {
        name,
        label: '',
        type: 'select',
        placeholder: field.placeholder,
        default: field.initial,
        choices: field.choices?.map(([value, label]) => [String(value), label]),
      };
    case 'number':
      return {
        name,
        label: '',
        type: 'number',
        placeholder:
          field.placeholder === undefined ? undefined : String(field.placeholder),
      };
    case 'string':
      return {
        name,
        label: '',
        type: 'string',
        placeholder: field.placeholder,
      };
    default:
      return {name, label: '', type: 'string'};
  }
}

function InlineField({
  data,
  disabled,
  index,
  name,
  field,
  resetsForm,
  onPropertyChange,
  onReset,
}: FieldProps & {field: JsonFormAdapterFieldConfig; resetsForm?: boolean}) {
  const placeholder = field.type === 'number' ? field.placeholder : undefined;

  const numValue =
    (data[name] && typeof data[name] !== 'boolean') || data[name] === 0
      ? Number(data[name])
      : NaN;

  // Set default value of number fields to the placeholder value
  useEffect(() => {
    if (
      data.id === IssueAlertFilterType.ISSUE_OCCURRENCES &&
      isNaN(numValue) &&
      !isNaN(Number(placeholder))
    ) {
      onPropertyChange(index, name, String(placeholder));
    }
    // Value omitted on purpose to avoid overwriting user changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPropertyChange, index, name, placeholder, data.id]);

  switch (field.type) {
    case 'select':
    case 'choice': {
      const allOptions = transformChoices(field.choices);

      const defaultValue = typeof field.default === 'string' ? field.default : undefined;

      let selectedValue: string | undefined;
      if (data[name] === undefined && allOptions.length > 0) {
        selectedValue = defaultValue ?? allOptions[0]?.value;
      } else {
        selectedValue = String(data[name]);
      }

      const options = filterCategoryChoices(data, name, allOptions, selectedValue);

      return (
        <InlineSelectControl
          isClearable={false}
          name={name}
          value={selectedValue}
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
            if (resetsForm) {
              onReset(index, name, value);
            } else {
              onPropertyChange(index, name, value);
            }
          }}
        />
      );
    }
    case 'number':
      return (
        <InlineNumberInput
          min={0}
          name={name}
          value={numValue}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={newVal => onPropertyChange(index, name, String(newVal))}
          aria-label={t('Value')}
        />
      );
    case 'string':
    case 'text': {
      const textValue =
        data[name] && typeof data[name] !== 'boolean' ? String(data[name]) : '';
      return (
        <InlineInput
          type="text"
          name={name}
          value={textValue}
          placeholder={field.placeholder}
          disabled={disabled}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            onPropertyChange(index, name, e.target.value)
          }
        />
      );
    }
    default:
      return null;
  }
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

export function isSchemaFormConfig(
  formFields: Record<string, IssueAlertRuleFormField> | SchemaFormConfig
): formFields is SchemaFormConfig {
  return 'uri' in formFields;
}

/**
 * Narrows node.formFields to a Record of form fields.
 * For ticket/sentryapp actions, formFields is a SchemaFormConfig — not a Record.
 */
function getFormFieldsRecord(
  node?: IssueAlertRuleActionTemplate | null
): Record<string, IssueAlertRuleFormField> | undefined {
  if (!node?.formFields || isSchemaFormConfig(node.formFields)) {
    return undefined;
  }
  return node.formFields;
}

function getSelectedCategoryLabel({data, node}: Pick<Props, 'data' | 'node'>) {
  const formFields = getFormFieldsRecord(node);
  const fieldConfig = formFields?.value;

  if (fieldConfig?.type !== 'choice') {
    return undefined;
  }

  return fieldConfig.choices?.find(
    ([value]: [string | number, string]) => value === data.value
  )?.[1];
}

/**
 * For the issue category filter, hide deprecated categories unless already selected.
 */
function filterCategoryChoices(
  data: Props['data'],
  name: string,
  options: Array<{label: string; value: string}>,
  selectedValue?: string
) {
  if (data.id === IssueAlertFilterType.ISSUE_CATEGORY && name === 'value') {
    return options.filter(
      opt =>
        VALID_ISSUE_CATEGORIES.includes(opt.label as IssueCategory) ||
        opt.value === selectedValue
    );
  }
  return options;
}

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
  node?: IssueAlertRuleActionTemplate | null;
}

export function RuleNode({
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

  const formFields = getFormFieldsRecord(node);

  function getField(name: string, fieldConfig: IssueAlertRuleFormField) {
    const fieldProps: FieldProps = {
      index,
      name,
      data,
      organization,
      project,
      disabled,
      onMemberTeamChange: handleMemberTeamChange,
      onPropertyChange,
      onReset,
    };

    // mailAction and assignee are special member/team pickers, not generic form fields
    if (fieldConfig.type === 'mailAction') {
      return <MailActionFields {...fieldProps} />;
    }
    if (fieldConfig.type === 'assignee') {
      return <AssigneeFilterFields {...fieldProps} />;
    }

    // Map backend field config to the adapter type system
    let adapterField = mapAlertRuleField(name, fieldConfig);

    // Override environment choices with project-specific values
    if (name === 'environment') {
      adapterField = {
        ...adapterField,
        type: 'select',
        choices: project.environments.map(env => [env, env]),
      };
    }

    return (
      <InlineField
        {...fieldProps}
        field={adapterField}
        resetsForm={fieldConfig.type === 'choice' ? fieldConfig.resetsForm : undefined}
      />
    );
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
          {formFields?.[key] ? getField(key, formFields[key]) : part}
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
    if (!node?.actionType) {
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
                link={node.link ?? null}
                ticketType={node.ticketType ?? t('an external issue')}
                instance={data as unknown as TicketActionData}
                onSubmitAction={updateParentFromTicketRule}
              />
            ))
          }
        >
          {t('Issue Link Settings')}
        </Button>
      );
    }

    if (
      node.actionType === 'sentryapp' &&
      node.sentryAppInstallationUuid &&
      node.formFields &&
      isSchemaFormConfig(node.formFields)
    ) {
      const sentryAppConfig = node.formFields;
      const sentryAppUuid = node.sentryAppInstallationUuid;
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
                  sentryAppInstallationUuid={sentryAppUuid}
                  config={sentryAppConfig}
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
          <FooterAlert variant="danger">
            {tct(
              "This project doesn't support sessions. [link:View supported platforms]",
              {
                link: (
                  <ExternalLink href="https://docs.sentry.io/product/releases/setup/#release-health" />
                ),
              }
            )}
          </FooterAlert>
        );
      }

      return (
        <FooterAlert variant="warning">
          {tct(
            'Percent of sessions affected is approximated by the ratio of the issue frequency to the number of sessions in the project. [link:Learn more.]',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/alerts/create-alerts/issue-alert-config/" />
              ),
            }
          )}
        </FooterAlert>
      );
    }

    if (data.id === IssueAlertActionType.SLACK) {
      return (
        <FooterAlert
          variant="info"
          trailingItems={
            <ExternalLink href="https://docs.sentry.io/product/integrations/notification-incidents/slack/#rate-limiting-error">
              {t('Learn More')}
            </ExternalLink>
          }
        >
          {t('Having rate limiting problems? Enter a channel or user ID.')}
        </FooterAlert>
      );
    }

    if (data.id === IssueAlertActionType.DISCORD) {
      return (
        <FooterAlert
          variant="info"
          trailingItems={
            <ExternalLink href="https://docs.sentry.io/product/accounts/early-adopter-features/discord/#issue-alerts">
              {t('Learn More')}
            </ExternalLink>
          }
        >
          {t('Note that you must enter a Discord channel ID, not a channel name.')}
        </FooterAlert>
      );
    }

    if (
      data.id === IssueAlertFilterType.ISSUE_CATEGORY &&
      !VALID_ISSUE_CATEGORIES.includes(
        getSelectedCategoryLabel({data, node}) as IssueCategory
      )
    ) {
      return (
        <FooterAlert variant="warning">
          {t(
            'Issue categories have been recently updated. Make a new selection to save changes.'
          )}
        </FooterAlert>
      );
    }

    return null;
  }

  function renderIncompatibleRuleBanner() {
    if (!incompatibleBanner) {
      return null;
    }
    return (
      <FooterAlert variant="danger">
        {t(
          'The conditions highlighted in red are in conflict. They may prevent the alert from ever being triggered.'
        )}
      </FooterAlert>
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
      <Flex align="center" padding="md">
        <Flex align="center" wrap="wrap" flex="1">
          <input type="hidden" name="id" value={data.id} />
          {renderRow()}
          {renderIntegrationButton()}
        </Flex>
        <DeleteButton
          disabled={disabled}
          aria-label={t('Delete Node')}
          onClick={handleDelete}
          size="sm"
          icon={<IconDelete />}
        />
      </Flex>
      {renderIncompatibleRuleBanner()}
      {conditionallyRenderHelpfulBanner()}
    </RuleRowContainer>
  );
}

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

const InlineSelectControl = styled(Select)`
  width: 180px;
`;

const Separator = styled('span')`
  margin-right: ${p => p.theme.space.md};
  padding-top: ${p => p.theme.space.xs};
  padding-bottom: ${p => p.theme.space.xs};
`;

const RuleRowContainer = styled('div')<{incompatible?: boolean}>`
  background-color: ${p => p.theme.tokens.background.secondary};
  border-radius: ${p => p.theme.radius.md};
  border: 1px ${p => p.theme.tokens.border.secondary} solid;
  border-color: ${p => (p.incompatible ? p.theme.colors.red200 : 'none')};
`;

const DeleteButton = styled(Button)`
  flex-shrink: 0;
`;

const FooterAlert = styled(Alert)`
  border-radius: 0 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md};
  margin-top: -1px; /* remove double border on panel bottom */
  a {
    white-space: nowrap;
  }
`;
