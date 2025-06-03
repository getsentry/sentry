import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {ConditionBadge} from 'sentry/components/workflowEngine/ui/conditionBadge';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Action} from 'sentry/types/workflowEngine/actions';
import type {
  DataCondition,
  DataConditionGroup,
} from 'sentry/types/workflowEngine/dataConditions';
import {actionNodesMap} from 'sentry/views/automations/components/actionNodes';
import {dataConditionNodesMap} from 'sentry/views/automations/components/dataConditionNodes';

type ConditionsPanelProps = {
  actionFilters: DataConditionGroup[];
  triggers: DataConditionGroup;
};

function ConditionsPanel({triggers, actionFilters}: ConditionsPanelProps) {
  return (
    <Panel>
      <Flex column gap={space(1)}>
        <div>
          {tct('[when:When] any of the following occur', {
            when: <ConditionBadge />,
          })}
        </div>
        {triggers.conditions.map((trigger, index) => (
          <div key={index}>
            <DataConditionDetails condition={trigger} />
          </div>
        ))}
      </Flex>
      {actionFilters.map((actionFilter, index) => (
        <div key={index}>
          <ActionFilter actionFilter={actionFilter} totalFilters={actionFilters.length} />
        </div>
      ))}
    </Panel>
  );
}

interface ActionFilterProps {
  actionFilter: DataConditionGroup;
  totalFilters: number;
}

function ActionFilter({actionFilter, totalFilters}: ActionFilterProps) {
  return (
    <ActionFilterWrapper showDivider={totalFilters > 1}>
      <div>
        {tct('[if:If] any of these filters match', {
          if: <ConditionBadge />,
        })}
      </div>
      {actionFilter.conditions.length > 0
        ? actionFilter.conditions.map((filter, index) => (
            <div key={index}>
              <DataConditionDetails condition={filter} />
            </div>
          ))
        : t('Any event')}
      <div>
        {tct('[then:Then] perform these actions', {
          then: <ConditionBadge />,
        })}
      </div>
      {actionFilter.actions?.map((action, index) => (
        <div key={index}>
          <ActionDetails action={action} />
        </div>
      ))}
    </ActionFilterWrapper>
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

function ActionDetails({action}: {action: Action}) {
  const node = actionNodesMap.get(action.type);
  const Component = node?.details;

  if (!Component) {
    return <span>{node?.label}</span>;
  }

  return <Component action={action} />;
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

const ActionFilterWrapper = styled('div')<{showDivider?: boolean}>`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};

  ${p =>
    p.showDivider &&
    css`
      padding-top: ${space(1.5)};
      border-top: 1px solid ${p.theme.translucentBorder};
    `}
`;

export default ConditionsPanel;
