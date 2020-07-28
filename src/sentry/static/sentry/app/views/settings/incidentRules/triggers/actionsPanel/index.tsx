import React from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {
  Action,
  ActionType,
  MetricActionTemplate,
  TargetType,
  Trigger,
} from 'app/views/settings/incidentRules/types';
import {Organization, Project, SelectValue} from 'app/types';
import {IconAdd} from 'app/icons';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {removeAtArrayIndex} from 'app/utils/removeAtArrayIndex';
import {replaceAtArrayIndex} from 'app/utils/replaceAtArrayIndex';
import {t} from 'app/locale';
import DeleteActionButton from 'app/views/settings/incidentRules/triggers/actionsPanel/deleteActionButton';
import Input from 'app/views/settings/components/forms/controls/input';
import LoadingIndicator from 'app/components/loadingIndicator';
import SelectControl from 'app/components/forms/selectControl';
import SelectMembers from 'app/components/selectMembers';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';
import FieldLabel from 'app/views/settings/components/forms/field/fieldLabel';
import FieldHelp from 'app/views/settings/components/forms/field/fieldHelp';
import Button from 'app/components/button';

const ActionLabel = {
  [ActionType.EMAIL]: t('E-mail'),
  [ActionType.SLACK]: t('Slack'),
  [ActionType.PAGER_DUTY]: t('Pagerduty'),
  [ActionType.MSTEAMS]: t('Microsoft Teams'),
};

const TargetLabel = {
  [TargetType.USER]: t('Member'),
  [TargetType.TEAM]: t('Team'),
};

type Props = {
  availableActions: MetricActionTemplate[] | null;
  currentProject: string;
  organization: Organization;
  projects: Project[];
  disabled: boolean;
  loading: boolean;
  error: boolean;

  triggers: Trigger[];
  className?: string;
  onAdd: (triggerIndex: number, action: Action) => void;
  onChange: (triggerIndex: number, triggers: Trigger[], actions: Action[]) => void;
};

const getPlaceholderForType = (type: ActionType) => {
  switch (type) {
    case ActionType.SLACK:
      return '@username or #channel';
    case ActionType.MSTEAMS:
      //no prefixes for msteams
      return 'username or channel';
    case ActionType.PAGER_DUTY:
      return 'service';
    default:
      throw Error('Not implemented');
  }
};

/**
 * Lists saved actions as well as control to add a new action
 */
class ActionsPanel extends React.PureComponent<Props> {
  /**
   * Actions have a type (e.g. email, slack, etc), but only some have
   * an integrationId (e.g. email is null). This helper creates a unique
   * id based on the type and integrationId so that we know what action
   * a user's saved action corresponds to.
   */
  getActionUniqueKey({type, integrationId}: Pick<Action, 'type' | 'integrationId'>) {
    return `${type}-${integrationId}`;
  }

  /**
   * Creates a human-friendly display name for the integration based on type and
   * server provided `integrationName`
   *
   * e.g. for slack we show that it is slack and the `integrationName` is the workspace name
   */
  getFullActionTitle({
    type,
    integrationName,
  }: Pick<MetricActionTemplate, 'type' | 'integrationName'>) {
    return `${ActionLabel[type]}${integrationName ? ` - ${integrationName}` : ''}`;
  }

  doChangeTargetIdentifier(triggerIndex: number, index: number, value: string) {
    const {triggers, onChange} = this.props;
    const {actions} = triggers[triggerIndex];
    const newAction = {
      ...actions[index],
      targetIdentifier: value,
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

    const action: Action = {
      type: actionConfig.type,
      targetType:
        actionConfig &&
        actionConfig.allowedTargetTypes &&
        actionConfig.allowedTargetTypes.length > 0
          ? actionConfig.allowedTargetTypes[0]
          : null,
      targetIdentifier: '',
      integrationId: actionConfig.integrationId,
    };

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
    const action = triggers[triggerIndex].actions[index];

    // Because we're moving it beween two different triggers the position of the
    // action could change, try to change it less by pushing or unshifting
    const position = value.value === 1 ? 'unshift' : 'push';
    triggers[value.value].actions[position](action);
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
      availableAction => this.getActionUniqueKey(availableAction) === value.value
    );
    if (!actionConfig) {
      addErrorMessage(t('There was a problem changing an action'));
      Sentry.captureException(new Error('Unable to change an action type'));
      return;
    }

    const newAction: Action = {
      type: actionConfig.type,
      targetType:
        actionConfig &&
        actionConfig.allowedTargetTypes &&
        actionConfig.allowedTargetTypes.length > 0
          ? actionConfig.allowedTargetTypes[0]
          : null,
      targetIdentifier: '',
      integrationId: actionConfig.integrationId,
    };
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

  handleChangeTargetIdentifier = (
    triggerIndex: number,
    index: number,
    value: SelectValue<string>
  ) => {
    this.doChangeTargetIdentifier(triggerIndex, index, value.value);
  };

  handleChangeSpecificTargetIdentifier = (
    triggerIndex: number,
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    this.doChangeTargetIdentifier(triggerIndex, index, e.target.value);
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

    const items =
      availableActions &&
      availableActions.map(availableAction => ({
        value: this.getActionUniqueKey(availableAction),
        label: this.getFullActionTitle(availableAction),
      }));

    const levels = [
      {value: 0, label: 'Critical Status'},
      {value: 1, label: 'Warning Status'},
    ];

    return (
      <Panel>
        <PanelHeader>{t('Actions')}</PanelHeader>
        <PanelBody withPadding>
          <FieldLabel>{t('Add an action')}</FieldLabel>
          <FieldHelp>
            {t(
              'We can send you an email or activate an integration when any of the thresholds above are met.'
            )}
          </FieldHelp>
        </PanelBody>
        <PanelBody>
          {loading && <LoadingIndicator />}
          {triggers.map((trigger, triggerIndex) => {
            const {actions} = trigger;
            return (
              actions &&
              actions.map((action: Action, i: number) => {
                const isUser = action.targetType === TargetType.USER;
                const isTeam = action.targetType === TargetType.TEAM;
                const hasOptions = action.targetType === TargetType.OPTIONS;
                const availableAction = availableActions?.find(
                  a => this.getActionUniqueKey(a) === this.getActionUniqueKey(action)
                );

                return (
                  <PanelItemGrid key={i}>
                    <SelectControl
                      name="select-level"
                      aria-label={t('Select a status level')}
                      isDisabled={disabled || loading}
                      placeholder={t('Select Level')}
                      onChange={this.handleChangeActionLevel.bind(this, triggerIndex, i)}
                      value={triggerIndex}
                      options={levels}
                    />

                    <SelectControl
                      name="select-action"
                      aria-label={t('Select an Action')}
                      isDisabled={disabled || loading}
                      placeholder={t('Select Action')}
                      onChange={this.handleChangeActionType.bind(this, triggerIndex, i)}
                      value={this.getActionUniqueKey(action)}
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
                        onChange={this.handleChangeTarget.bind(this, triggerIndex, i)}
                      />
                    ) : (
                      <span />
                    )}

                    {isUser || isTeam ? (
                      <SelectMembers
                        disabled={disabled}
                        key={isTeam ? 'team' : 'member'}
                        showTeam={isTeam}
                        project={projects.find(({slug}) => slug === currentProject)}
                        organization={organization}
                        value={action.targetIdentifier}
                        onChange={this.handleChangeTargetIdentifier.bind(
                          this,
                          triggerIndex,
                          i
                        )}
                      />
                    ) : hasOptions ? (
                      <SelectControl
                        isDisabled={disabled || loading}
                        value={action.targetType}
                        options={availableAction?.allowedTargetTypes?.map(
                          allowedType => ({
                            value: allowedType,
                            label: TargetLabel[allowedType],
                          })
                        )}
                        onChange={this.handleChangeTarget.bind(this, triggerIndex, i)}
                      />
                    ) : (
                      <Input
                        disabled={disabled}
                        key={action.type}
                        value={action.targetIdentifier}
                        onChange={this.handleChangeSpecificTargetIdentifier.bind(
                          this,
                          triggerIndex,
                          i
                        )}
                        placeholder={getPlaceholderForType(action.type)}
                      />
                    )}
                    <DeleteActionButton
                      triggerIndex={triggerIndex}
                      index={i}
                      onClick={this.handleDeleteAction}
                      disabled={disabled}
                    />
                  </PanelItemGrid>
                );
              })
            );
          })}
          <StyledPanelItem>
            <Button
              type="button"
              disabled={disabled || loading}
              size="small"
              icon={<IconAdd isCircled color="gray500" />}
              onClick={this.handleAddAction}
            >
              Add Item
            </Button>
          </StyledPanelItem>
        </PanelBody>
      </Panel>
    );
  }
}

const ActionsPanelWithSpace = styled(ActionsPanel)`
  margin-top: ${space(4)};
`;

const PanelItemGrid = styled(PanelItem)`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr min-content;
  align-items: center;
  grid-gap: ${space(2)};
  padding: ${space(0.5)} ${space(2)} ${space(1)};
  border-bottom: 0;
`;

const StyledPanelItem = styled(PanelItem)`
  padding: ${space(1)} ${space(2)} ${space(2)};
`;

export default withOrganization(ActionsPanelWithSpace);
