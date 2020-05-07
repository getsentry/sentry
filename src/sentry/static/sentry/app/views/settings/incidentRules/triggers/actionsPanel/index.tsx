import React from 'react';
import * as Sentry from '@sentry/browser';
import styled from '@emotion/styled';

import {
  Action,
  ActionType,
  MetricActionTemplate,
  TargetType,
} from 'app/views/settings/incidentRules/types';
import {Organization, Project, SelectValue} from 'app/types';
import {PanelItem} from 'app/components/panels';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {removeAtArrayIndex} from 'app/utils/removeAtArrayIndex';
import {replaceAtArrayIndex} from 'app/utils/replaceAtArrayIndex';
import {t} from 'app/locale';
import DeleteActionButton from 'app/views/settings/incidentRules/triggers/actionsPanel/deleteActionButton';
import Input from 'app/views/settings/components/forms/controls/input';
import LoadingIndicator from 'app/components/loadingIndicator';
import PanelSubHeader from 'app/views/settings/incidentRules/triggers/panelSubHeader';
import SelectControl from 'app/components/forms/selectControl';
import SelectMembers from 'app/components/selectMembers';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

const ActionLabel = {
  [ActionType.EMAIL]: t('E-mail'),
  [ActionType.SLACK]: t('Slack'),
  [ActionType.PAGER_DUTY]: t('Pagerduty'),
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

  actions: Action[];
  className?: string;
  triggerIndex: number;
  onAdd: (action: Action) => void;
  onChange: (actions: Action[]) => void;
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

  doChangeTargetIdentifier(index: number, value: string) {
    const {actions, onChange} = this.props;
    const newAction = {
      ...actions[index],
      targetIdentifier: value,
    };

    onChange(replaceAtArrayIndex(actions, index, newAction));
  }

  handleAddAction = (value: {label: string; value: string}) => {
    const {availableActions} = this.props;

    const actionConfig =
      availableActions &&
      availableActions.find(
        availableAction => this.getActionUniqueKey(availableAction) === value.value
      );

    if (!actionConfig) {
      addErrorMessage(t('There was a problem adding an action'));
      Sentry.setExtras({
        integrationId: value,
      });
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

    this.props.onAdd(action);
  };
  handleDeleteAction = (index: number) => {
    const {actions, onChange} = this.props;

    onChange(removeAtArrayIndex(actions, index));
  };

  handleChangeTarget = (index: number, value: SelectValue<keyof typeof TargetLabel>) => {
    const {actions, onChange} = this.props;
    const newAction = {
      ...actions[index],
      targetType: value.value,
      targetIdentifier: '',
    };

    onChange(replaceAtArrayIndex(actions, index, newAction));
  };

  handleChangeTargetIdentifier = (index: number, value: SelectValue<string>) => {
    this.doChangeTargetIdentifier(index, value.value);
  };

  handleChangeSpecificTargetIdentifier = (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    this.doChangeTargetIdentifier(index, e.target.value);
  };

  render() {
    const {
      actions,
      availableActions,
      currentProject,
      disabled,
      loading,
      organization,
      projects,
    } = this.props;

    const items =
      availableActions &&
      availableActions.map(availableAction => ({
        value: this.getActionUniqueKey(availableAction),
        label: this.getFullActionTitle(availableAction),
      }));

    return (
      <React.Fragment>
        <PanelSubHeader>{t('Actions')}</PanelSubHeader>
        <React.Fragment>
          {loading && <LoadingIndicator />}
          {actions &&
            actions.map((action: Action, i: number) => {
              const isUser = action.targetType === TargetType.USER;
              const isTeam = action.targetType === TargetType.TEAM;
              const availableAction = availableActions?.find(
                a => this.getActionUniqueKey(a) === this.getActionUniqueKey(action)
              );

              return (
                <PanelItemGrid key={i}>
                  {this.getFullActionTitle({
                    type: action.type,
                    integrationName: availableAction?.integrationName ?? '',
                  })}

                  {availableAction && availableAction.allowedTargetTypes.length > 1 ? (
                    <SelectControl
                      disabled={disabled || loading}
                      value={action.targetType}
                      options={availableAction?.allowedTargetTypes?.map(allowedType => ({
                        value: allowedType,
                        label: TargetLabel[allowedType],
                      }))}
                      onChange={this.handleChangeTarget.bind(this, i)}
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
                      onChange={this.handleChangeTargetIdentifier.bind(this, i)}
                    />
                  ) : (
                    <Input
                      disabled={disabled}
                      key={action.type}
                      value={action.targetIdentifier}
                      onChange={this.handleChangeSpecificTargetIdentifier.bind(this, i)}
                      placeholder="@username or #channel"
                    />
                  )}
                  <DeleteActionButton
                    index={i}
                    onClick={this.handleDeleteAction}
                    disabled={disabled}
                  />
                </PanelItemGrid>
              );
            })}
          <PanelItem>
            <StyledSelectControl
              name="add-action"
              aria-label={t('Add an Action')}
              isDisabled={disabled || loading}
              placeholder={t('Add an Action')}
              onChange={this.handleAddAction}
              value={null}
              options={items ?? []}
            />
          </PanelItem>
        </React.Fragment>
      </React.Fragment>
    );
  }
}

const ActionsPanelWithSpace = styled(ActionsPanel)`
  margin-top: ${space(4)};
`;

const PanelItemGrid = styled(PanelItem)`
  display: grid;
  grid-template-columns: 1fr 1fr 1fr min-content;
  align-items: center;
  grid-gap: ${space(2)};
`;

const StyledSelectControl = styled(SelectControl)`
  width: 100%;
`;

export default withOrganization(ActionsPanelWithSpace);
