import {Fragment, PureComponent} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import SelectControl from 'sentry/components/forms/selectControl';
import ListItem from 'sentry/components/list/listItem';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PanelItem} from 'sentry/components/panels';
import {IconAdd, IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project, SelectValue} from 'sentry/types';
import {uniqueId} from 'sentry/utils/guid';
import {removeAtArrayIndex} from 'sentry/utils/removeAtArrayIndex';
import {replaceAtArrayIndex} from 'sentry/utils/replaceAtArrayIndex';
import withOrganization from 'sentry/utils/withOrganization';
import ActionSpecificTargetSelector from 'sentry/views/alerts/incidentRules/triggers/actionsPanel/actionSpecificTargetSelector';
import ActionTargetSelector from 'sentry/views/alerts/incidentRules/triggers/actionsPanel/actionTargetSelector';
import DeleteActionButton from 'sentry/views/alerts/incidentRules/triggers/actionsPanel/deleteActionButton';
import {
  Action,
  ActionLabel,
  ActionType,
  MetricActionTemplate,
  TargetLabel,
  Trigger,
} from 'sentry/views/alerts/incidentRules/types';
import SentryAppRuleModal from 'sentry/views/alerts/issueRuleEditor/sentryAppRuleModal';

type Props = {
  availableActions: MetricActionTemplate[] | null;
  currentProject: string;
  disabled: boolean;
  error: boolean;
  loading: boolean;
  onAdd: (triggerIndex: number, action: Action) => void;
  onChange: (triggerIndex: number, triggers: Trigger[], actions: Action[]) => void;

  organization: Organization;
  projects: Project[];
  triggers: Trigger[];
  className?: string;
};

/**
 * When a new action is added, all of it's settings should be set to their default values.
 * @param actionConfig
 * @param dateCreated kept to maintain order of unsaved actions
 */
const getCleanAction = (actionConfig, dateCreated?: string): Action => {
  return {
    unsavedId: uniqueId(),
    unsavedDateCreated: dateCreated ?? new Date().toISOString(),
    type: actionConfig.type,
    targetType:
      actionConfig &&
      actionConfig.allowedTargetTypes &&
      actionConfig.allowedTargetTypes.length > 0
        ? actionConfig.allowedTargetTypes[0]
        : null,
    targetIdentifier: actionConfig.sentryAppId || '',
    inputChannelId: null,
    integrationId: actionConfig.integrationId,
    sentryAppId: actionConfig.sentryAppId,
    options: actionConfig.options || null,
  };
};

/**
 * Actions have a type (e.g. email, slack, etc), but only some have
 * an integrationId (e.g. email is null). This helper creates a unique
 * id based on the type and integrationId so that we know what action
 * a user's saved action corresponds to.
 */
const getActionUniqueKey = ({
  type,
  integrationId,
  sentryAppId,
}: Pick<Action, 'type' | 'integrationId' | 'sentryAppId'>) => {
  if (integrationId) {
    return `${type}-${integrationId}`;
  }
  if (sentryAppId) {
    return `${type}-${sentryAppId}`;
  }
  return type;
};

/**
 * Creates a human-friendly display name for the integration based on type and
 * server provided `integrationName`
 *
 * e.g. for slack we show that it is slack and the `integrationName` is the workspace name
 */
const getFullActionTitle = ({
  type,
  integrationName,
  sentryAppName,
  status,
}: Pick<
  MetricActionTemplate,
  'type' | 'integrationName' | 'sentryAppName' | 'status'
>) => {
  if (sentryAppName) {
    if (status && status !== 'published') {
      return `${sentryAppName} (${status})`;
    }
    return `${sentryAppName}`;
  }

  const label = ActionLabel[type];
  if (integrationName) {
    return `${label} - ${integrationName}`;
  }
  return label;
};

/**
 * Lists saved actions as well as control to add a new action
 */
class ActionsPanel extends PureComponent<Props> {
  handleChangeKey(
    triggerIndex: number,
    index: number,
    key: 'targetIdentifier' | 'inputChannelId',
    value: string
  ) {
    const {triggers, onChange} = this.props;
    const {actions} = triggers[triggerIndex];
    const newAction = {
      ...actions[index],
      [key]: value,
    };

    onChange(triggerIndex, triggers, replaceAtArrayIndex(actions, index, newAction));
  }

  handleAddAction = () => {
    const {availableActions, onAdd} = this.props;
    const actionConfig = availableActions?.[0];

    if (!actionConfig) {
      addErrorMessage(t('There was a problem adding an action'));
      Sentry.captureException(new Error('Unable to add an action'));
      return;
    }

    const action: Action = getCleanAction(actionConfig);

    // Add new actions to critical by default
    const triggerIndex = 0;
    onAdd(triggerIndex, action);
  };

  handleDeleteAction = (triggerIndex: number, index: number) => {
    const {triggers, onChange} = this.props;
    const {actions} = triggers[triggerIndex];

    onChange(triggerIndex, triggers, removeAtArrayIndex(actions, index));
  };

  handleChangeActionLevel = (
    triggerIndex: number,
    index: number,
    value: SelectValue<number>
  ) => {
    const {triggers, onChange} = this.props;
    // Convert saved action to unsaved by removing id
    const {id: _, ...action} = triggers[triggerIndex].actions[index];
    action.unsavedId = uniqueId();
    triggers[value.value].actions.push(action);
    onChange(value.value, triggers, triggers[value.value].actions);
    this.handleDeleteAction(triggerIndex, index);
  };

  handleChangeActionType = (
    triggerIndex: number,
    index: number,
    value: SelectValue<ActionType>
  ) => {
    const {triggers, onChange, availableActions} = this.props;
    const {actions} = triggers[triggerIndex];
    const actionConfig = availableActions?.find(
      availableAction => getActionUniqueKey(availableAction) === value.value
    );
    if (!actionConfig) {
      addErrorMessage(t('There was a problem changing an action'));
      Sentry.captureException(new Error('Unable to change an action type'));
      return;
    }

    const existingDateCreated =
      actions[index].dateCreated ?? actions[index].unsavedDateCreated;
    const newAction: Action = getCleanAction(actionConfig, existingDateCreated);
    onChange(triggerIndex, triggers, replaceAtArrayIndex(actions, index, newAction));
  };

  handleChangeTarget = (
    triggerIndex: number,
    index: number,
    value: SelectValue<keyof typeof TargetLabel>
  ) => {
    const {triggers, onChange} = this.props;
    const {actions} = triggers[triggerIndex];
    const newAction = {
      ...actions[index],
      targetType: value.value,
      targetIdentifier: '',
    };

    onChange(triggerIndex, triggers, replaceAtArrayIndex(actions, index, newAction));
  };

  /**
   * Update the Trigger's Action fields from the SentryAppRuleModal together
   * only after the user clicks "Save Changes".
   * @param formData Form data
   */
  updateParentFromSentryAppRule = (
    triggerIndex: number,
    actionIndex: number,
    formData: {[key: string]: string}
  ): void => {
    const {triggers, onChange} = this.props;
    const {actions} = triggers[triggerIndex];
    const newAction = {
      ...actions[actionIndex],
      ...formData,
    };

    onChange(
      triggerIndex,
      triggers,
      replaceAtArrayIndex(actions, actionIndex, newAction)
    );
  };

  render() {
    const {
      availableActions,
      currentProject,
      disabled,
      loading,
      organization,
      projects,
      triggers,
    } = this.props;

    const project = projects.find(({slug}) => slug === currentProject);
    const items = availableActions?.map(availableAction => ({
      value: getActionUniqueKey(availableAction),
      label: getFullActionTitle(availableAction),
    }));

    const levels = [
      {value: 0, label: 'Critical Status'},
      {value: 1, label: 'Warning Status'},
    ];

    // Create single array of unsaved and saved trigger actions
    // Sorted by date created ascending
    const actions = triggers
      .flatMap((trigger, triggerIndex) => {
        return trigger.actions.map((action, actionIdx) => {
          const availableAction = availableActions?.find(
            a => getActionUniqueKey(a) === getActionUniqueKey(action)
          );
          return {
            dateCreated: new Date(
              action.dateCreated ?? action.unsavedDateCreated
            ).getTime(),
            triggerIndex,
            action,
            actionIdx,
            availableAction,
          };
        });
      })
      .sort((a, b) => a.dateCreated - b.dateCreated);

    return (
      <Fragment>
        <PerformActionsListItem>
          {t('Perform actions')}
          <AlertParagraph>
            {t(
              'When any of the thresholds above are met, perform an action such as sending an email or using an integration.'
            )}
          </AlertParagraph>
        </PerformActionsListItem>
        {loading && <LoadingIndicator />}
        {actions.map(({action, actionIdx, triggerIndex, availableAction}) => {
          return (
            <div key={action.id ?? action.unsavedId}>
              <RuleRowContainer>
                <PanelItemGrid>
                  <PanelItemSelects>
                    <SelectControl
                      name="select-level"
                      aria-label={t('Select a status level')}
                      isDisabled={disabled || loading}
                      placeholder={t('Select Level')}
                      onChange={this.handleChangeActionLevel.bind(
                        this,
                        triggerIndex,
                        actionIdx
                      )}
                      value={triggerIndex}
                      options={levels}
                    />
                    <SelectControl
                      name="select-action"
                      aria-label={t('Select an Action')}
                      isDisabled={disabled || loading}
                      placeholder={t('Select Action')}
                      onChange={this.handleChangeActionType.bind(
                        this,
                        triggerIndex,
                        actionIdx
                      )}
                      value={getActionUniqueKey(action)}
                      options={items ?? []}
                    />

                    {availableAction && availableAction.allowedTargetTypes.length > 1 ? (
                      <SelectControl
                        isDisabled={disabled || loading}
                        value={action.targetType}
                        options={availableAction?.allowedTargetTypes?.map(
                          allowedType => ({
                            value: allowedType,
                            label: TargetLabel[allowedType],
                          })
                        )}
                        onChange={this.handleChangeTarget.bind(
                          this,
                          triggerIndex,
                          actionIdx
                        )}
                      />
                    ) : availableAction &&
                      availableAction.type === 'sentry_app' &&
                      availableAction.settings ? (
                      <Button
                        icon={<IconSettings />}
                        type="button"
                        onClick={() => {
                          openModal(
                            deps => (
                              <SentryAppRuleModal
                                {...deps}
                                // Using ! for keys that will exist for sentryapps
                                sentryAppInstallationUuid={
                                  availableAction.sentryAppInstallationUuid!
                                }
                                config={availableAction.settings!}
                                appName={availableAction.sentryAppName!}
                                onSubmitSuccess={this.updateParentFromSentryAppRule.bind(
                                  this,
                                  triggerIndex,
                                  actionIdx
                                )}
                                resetValues={
                                  triggers[triggerIndex].actions[actionIdx] || {}
                                }
                              />
                            ),
                            {allowClickClose: false}
                          );
                        }}
                      >
                        {t('Settings')}
                      </Button>
                    ) : null}
                    <ActionTargetSelector
                      action={action}
                      availableAction={availableAction}
                      disabled={disabled}
                      loading={loading}
                      onChange={this.handleChangeKey.bind(
                        this,
                        triggerIndex,
                        actionIdx,
                        'targetIdentifier'
                      )}
                      organization={organization}
                      project={project}
                    />
                    <ActionSpecificTargetSelector
                      action={action}
                      disabled={disabled}
                      onChange={this.handleChangeKey.bind(
                        this,
                        triggerIndex,
                        actionIdx,
                        'inputChannelId'
                      )}
                    />
                  </PanelItemSelects>
                  <DeleteActionButton
                    triggerIndex={triggerIndex}
                    index={actionIdx}
                    onClick={this.handleDeleteAction}
                    disabled={disabled}
                  />
                </PanelItemGrid>
              </RuleRowContainer>
            </div>
          );
        })}
        <ActionSection>
          <Button
            type="button"
            disabled={disabled || loading}
            icon={<IconAdd isCircled color="gray300" />}
            onClick={this.handleAddAction}
          >
            {t('Add Action')}
          </Button>
        </ActionSection>
      </Fragment>
    );
  }
}

const ActionsPanelWithSpace = styled(ActionsPanel)`
  margin-top: ${space(4)};
`;

const ActionSection = styled('div')`
  margin-top: ${space(1)};
  margin-bottom: ${space(3)};
`;

const AlertParagraph = styled('p')`
  color: ${p => p.theme.subText};
  margin-bottom: ${space(1)};
  font-size: ${p => p.theme.fontSizeLarge};
`;

const PanelItemGrid = styled(PanelItem)`
  display: flex;
  align-items: center;
  border-bottom: 0;
  padding: ${space(1)};
`;

const PanelItemSelects = styled('div')`
  display: flex;
  width: 100%;
  margin-right: ${space(1)};
  > * {
    flex: 0 1 200px;

    &:not(:last-child) {
      margin-right: ${space(1)};
    }
  }
`;

const RuleRowContainer = styled('div')`
  background-color: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px ${p => p.theme.border} solid;
`;

const StyledListItem = styled(ListItem)`
  margin: ${space(2)} 0 ${space(3)} 0;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const PerformActionsListItem = styled(StyledListItem)`
  margin-bottom: 0;
  line-height: 1.3;
`;

export default withOrganization(ActionsPanelWithSpace);
