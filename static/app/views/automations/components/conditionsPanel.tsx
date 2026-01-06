import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Placeholder from 'sentry/components/placeholder';
import {ConditionBadge} from 'sentry/components/workflowEngine/ui/conditionBadge';
import {IconWarning} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {
  ActionType,
  SentryAppIdentifier,
  type Action,
  type ActionHandler,
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
      <ConditionGroupWrapper>
        <ConditionGroupHeader>
          {tct(
            '[when:When] an issue event is captured and [logicType] of the following occur',
            {
              when: <ConditionBadge />,
              logicType:
                TRIGGER_MATCH_OPTIONS.find(choice => choice.value === triggers?.logicType)
                  ?.label || t('any'),
            }
          )}
        </ConditionGroupHeader>
        {triggers?.conditions?.map((trigger, index) => (
          <div key={index}>
            <DataConditionDetails condition={trigger} />
          </div>
        ))}
        {(!triggers || triggers.conditions.length === 0) && t('An event is captured')}
      </ConditionGroupWrapper>
      {actionFilters.map((actionFilter, index) => (
        <div key={index}>
          <ActionFilter
            actionFilter={actionFilter}
            showDivider={actionFilters.length > 1}
          />
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
    if (action.config.sentryAppIdentifier === SentryAppIdentifier.SENTRY_APP_ID) {
      return availableActions.find(
        handler => handler.sentryApp?.id === action.config.targetIdentifier
      );
    }
    return availableActions.find(
      handler => handler.sentryApp?.installationUuid === action.config.targetIdentifier
    );
  }
  return availableActions.find(handler => handler.type === action.type);
}

interface ActionFilterProps {
  actionFilter: DataConditionGroup;
  showDivider: boolean;
}

function ActionFilter({actionFilter, showDivider}: ActionFilterProps) {
  const {data: availableActions = [], isLoading} = useAvailableActionsQuery();

  return (
    <ConditionGroupWrapper showDivider={showDivider}>
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
      {isLoading
        ? actionFilter.actions?.map((_, index) => (
            <Placeholder key={index} height="10px" />
          ))
        : actionFilter.actions?.map((action, index) => (
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

  return (
    <Fragment>
      {action.status === 'disabled' && (
        <IconPadding>
          <IconWarning variant="danger" />
        </IconPadding>
      )}
      {!Component || !handler ? (
        <span>{node?.label}</span>
      ) : (
        <Component action={action} handler={handler} />
      )}
    </Fragment>
  );
}

const Panel = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.lg};
  background-color: ${p => p.theme.backgroundSecondary};
  border: 1px solid ${p => p.theme.translucentBorder};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space.lg};
  word-break: break-word;
`;

const ConditionGroupHeader = styled('div')`
  color: ${p => p.theme.tokens.content.primary};
`;

const ConditionGroupWrapper = styled('div')<{showDivider?: boolean}>`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
  color: ${p => p.theme.subText};

  ${p =>
    p.showDivider &&
    css`
      padding-top: ${p.theme.space.lg};
      border-top: 1px solid ${p.theme.translucentBorder};
    `}
`;

const IconPadding = styled('span')`
  padding-right: ${p => p.theme.space.sm};
  height: 100%;
  vertical-align: middle;
`;

export default ConditionsPanel;
