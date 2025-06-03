import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
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
            when: <Badge />,
          })}
        </div>
        {triggers.conditions.map((trigger, index) => (
          <div key={index}>
            <Details item={trigger} nodesMap={dataConditionNodesMap} />
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
          if: <Badge />,
        })}
      </div>
      {actionFilter.conditions.length > 0
        ? actionFilter.conditions.map((filter, index) => (
            <div key={index}>
              <Details item={filter} nodesMap={dataConditionNodesMap} />
            </div>
          ))
        : t('Any event')}
      <div>
        {tct('[then:Then] perform these actions', {
          then: <Badge />,
        })}
      </div>
      {actionFilter.actions?.map((action, index) => (
        <div key={index}>
          <Details item={action} nodesMap={actionNodesMap} />
        </div>
      ))}
    </ActionFilterWrapper>
  );
}

function Details<T extends DataCondition | Action>({
  item,
  nodesMap,
}: {
  item: T;
  nodesMap: Map<string, {details?: (item: T) => React.ReactNode; label?: string}>;
}) {
  const node = nodesMap.get(item.type);
  const Component = node?.details;

  if (!Component) {
    return <span>{node?.label}</span>;
  }

  return Component(item);
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

const Badge = styled('span')`
  display: inline-block;
  background-color: ${p => p.theme.purple300};
  padding: 0 ${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.white};
  text-transform: uppercase;
  text-align: center;
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
  line-height: 1.5;
`;

const ActionFilterWrapper = styled('div')<{showDivider?: boolean}>`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};

  ${p =>
    p.showDivider &&
    `
    padding-top: ${space(1.5)};
    border-top: 1px solid ${p.theme.translucentBorder};
  `}
`;

export default ConditionsPanel;
