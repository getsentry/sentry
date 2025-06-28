import {css} from '@emotion/react';
import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {ConditionBadge} from 'sentry/components/workflowEngine/ui/conditionBadge';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  type Action,
  type ActionHandler,
  ActionType,
  SentryAppIdentifier,
} from 'sentry/types/workflowEngine/actions';
import type {
  DataCondition,
  DataConditionGroup,
} from 'sentry/types/workflowEngine/dataConditions';
import {FILTER_MATCH_OPTIONS} from 'sentry/views/automations/components/actionFilters/constants';
import {actionNodesMap} from 'sentry/views/automations/components/actionNodes';
import {dataConditionNodesMap} from 'sentry/views/automations/components/dataConditionNodes';
import {TRIGGER_MATCH_OPTIONS} from 'sentry/views/automations/components/triggers/constants';
import {useAvailableActionsQuery} from 'sentry/views/automations/hooks';

type ConditionsPanelProps = {
  actionFilters: DataConditionGroup[];
  triggers: DataConditionGroup | null;
};

function ConditionsPanel({triggers, actionFilters}: ConditionsPanelProps) {
  return (
    <Panel>
      {triggers && (
        <ConditionGroupWrapper>
          <ConditionGroupHeader>
            {tct('[when:When] [logicType] of the following occur', {
              when: <ConditionBadge />,
              logicType:
                TRIGGER_MATCH_OPTIONS.find(choice => choice.value === triggers.logicType)
                  ?.label || triggers.logicType,
            })}
          </ConditionGroupHeader>
          {triggers.conditions.map((trigger, index) => (
            <div key={index}>
              <DataConditionDetails condition={trigger} />
            </div>
          ))}
        </ConditionGroupWrapper>
      )}
      {actionFilters.map((actionFilter, index) => (
        <div key={index}>
          <ActionFilter actionFilter={actionFilter} totalFilters={actionFilters.length} />
        </div>
      ))}
    </Panel>
  );
}

function findActionHandler(
  action: Action,
  availableActions: ActionHandler[]
): ActionHandler | undefined {
  if (action.type === ActionType.SENTRY_APP) {
    if (action.config.sentry_app_identifier === SentryAppIdentifier.SENTRY_APP_ID) {
      return availableActions.find(
        handler => handler.sentryApp?.id === action.config.target_identifier
      );
    }
    return availableActions.find(
      handler => handler.sentryApp?.installationUuid === action.config.target_identifier
    );
  }
  return availableActions.find(handler => handler.type === action.type);
}

interface ActionFilterProps {
  actionFilter: DataConditionGroup;
  totalFilters: number;
}

function ActionFilter({actionFilter, totalFilters}: ActionFilterProps) {
  const {data: availableActions = [], isLoading} = useAvailableActionsQuery();

  if (isLoading) {
    return <LoadingIndicator />;
  }

  return (
    <ConditionGroupWrapper showDivider={totalFilters > 1}>
      <ConditionGroupHeader>
        {tct('[if:If] [logicType] of these filters match', {
          if: <ConditionBadge />,
          logicType:
            FILTER_MATCH_OPTIONS.find(choice => choice.value === actionFilter.logicType)
              ?.label || actionFilter.logicType,
        })}
      </ConditionGroupHeader>
      {actionFilter.conditions.length > 0
        ? actionFilter.conditions.map((filter, index) => (
            <div key={index}>
              <DataConditionDetails condition={filter} />
            </div>
          ))
        : t('Any event')}
      <ConditionGroupHeader>
        {tct('[then:Then] perform these actions', {
          then: <ConditionBadge />,
        })}
      </ConditionGroupHeader>
      {actionFilter.actions?.map((action, index) => (
        <div key={index}>
          <ActionDetails
            action={action}
            handler={findActionHandler(action, availableActions)}
          />
        </div>
      ))}
    </ConditionGroupWrapper>
  );
}

function DataConditionDetails({condition}: {condition: DataCondition}) {
  const node = dataConditionNodesMap.get(condition.type);
  const Component = node?.details;

  if (!Component) {
    return <span>{node?.label}</span>;
  }

  return <Component condition={condition} />;
}

interface ActionDetailsProps {
  action: Action;
  handler: ActionHandler | undefined;
}

function ActionDetails({action, handler}: ActionDetailsProps) {
  const node = actionNodesMap.get(action.type);
  const Component = node?.details;

  if (!Component || !handler) {
    return <span>{node?.label}</span>;
  }

  return <Component action={action} handler={handler} />;
}

const Panel = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1.5)};
  background-color: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.translucentBorder};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1.5)};
`;

const ConditionGroupHeader = styled('div')`
  color: ${p => p.theme.textColor};
`;

const ConditionGroupWrapper = styled('div')<{showDivider?: boolean}>`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  color: ${p => p.theme.subText};

  ${p =>
    p.showDivider &&
    css`
      padding-top: ${space(1.5)};
      border-top: 1px solid ${p.theme.translucentBorder};
    `}
`;

export default ConditionsPanel;
