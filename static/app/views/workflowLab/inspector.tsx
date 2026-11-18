import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Tabs} from '@sentry/scraps/tabs';
import {Heading, Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {NotebookPreview} from 'sentry/views/investigations/detail/notebookPreview';

import type {Plan, ProofResult, Run} from './api';

export function JsonValue({value}: {value: unknown}) {
  return <Pre>{JSON.stringify(value, null, 2)}</Pre>;
}

const Pre = styled('pre')`
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

export function WorkflowGraph({plan, nodes}: {plan: Plan; nodes?: Run['nodes']}) {
  const [selected, setSelected] = useState(plan.output);
  // The validator supplies topological order, including independent branches.
  const positions = new Map<string, {column: number; row: number}>();
  const columns: number[] = [];
  for (const name of plan.order) {
    const column = Math.max(
      0,
      ...(plan.dependencies[name] ?? []).map(
        parent => (positions.get(parent)?.column ?? 0) + 1
      )
    );
    const row = columns[column] ?? 0;
    positions.set(name, {column, row});
    columns[column] = row + 1;
  }
  const selectedRuns = nodes?.filter(node => node.name === selected);
  return (
    <Stack gap="sm">
      <Heading as="h3">{t('Workflow graph')}</Heading>
      <GraphScroll>
        <GraphCanvas
          style={{
            width: Math.max(1, columns.length) * 152,
            height: Math.max(1, ...columns) * 54,
          }}
        >
          <Edges aria-hidden="true">
            {plan.order.flatMap(name =>
              (plan.dependencies[name] ?? []).map(parent => {
                const from = positions.get(parent)!;
                const to = positions.get(name)!;
                return (
                  <line
                    key={parent + '/' + name}
                    x1={from.column * 152 + 128}
                    y1={from.row * 54 + 20}
                    x2={to.column * 152}
                    y2={to.row * 54 + 20}
                  />
                );
              })
            )}
          </Edges>
          {Array.from(positions, ([name, {column, row}]) => (
            <NodePosition key={name} style={{left: column * 152, top: row * 54}}>
              <GraphButton
                size="sm"
                aria-pressed={selected === name}
                onClick={() => setSelected(name)}
              >
                {name}
              </GraphButton>
            </NodePosition>
          ))}
        </GraphCanvas>
      </GraphScroll>
      <Text>
        {plan.dependencies[selected]?.length
          ? t('%s runs after %s', selected, plan.dependencies[selected].join(', '))
          : t('%s starts with the workflow input', selected)}
      </Text>
      {selectedRuns?.map(node => (
        <details key={node.id}>
          <summary>
            {node.name} · {node.status}
          </summary>
          <JsonValue value={node} />
        </details>
      ))}
    </Stack>
  );
}

const GraphScroll = styled('div')`
  overflow-x: auto;
`;
const GraphCanvas = styled('div')`
  position: relative;
`;
const Edges = styled('svg')`
  position: absolute;
  width: 100%;
  height: 100%;
  stroke: currentColor;
`;
const NodePosition = styled('div')`
  position: absolute;
  width: 128px;
`;

const GraphButton = styled(Button)`
  width: 100%;
`;

export type ResultTab = 'activity' | 'output' | 'notebook' | 'details' | 'usage';

interface InspectorProps {
  notebook: boolean;
  onTabChange: (tab: ResultTab) => void;
  tab: ResultTab;
  proof?: ProofResult;
  run?: Run;
}

export function RunInspector({notebook, onTabChange, tab, proof, run}: InspectorProps) {
  const keys: ResultTab[] = [
    'activity',
    'output',
    ...(notebook ? ['notebook' as const] : []),
    'details',
    'usage',
  ];
  const labels = {
    activity: t('Activity'),
    output: t('Output'),
    notebook: t('Notebook'),
    details: t('Run details'),
    usage: t('Usage'),
  };
  const panels = {
    activity: (
      <Fragment>
        <Stack gap="md" padding="md">
          {proof ? (
            proof.events
              .filter(event => event.message)
              .map((event, i) => <Text key={i}>{event.message}</Text>)
          ) : run?.activity.length ? (
            run.activity.map(event => (
              <Stack key={event.id} gap="xs">
                <Text bold>
                  {run.nodes.find(node => node.id === event.node)?.name} · {event.role}
                </Text>
                <Text>{event.message}</Text>
                {event.tools.length > 0 && <code>{event.tools.join(', ')}</code>}
              </Stack>
            ))
          ) : (
            <Text>{t('No activity yet.')}</Text>
          )}
        </Stack>
      </Fragment>
    ),
    output: (
      <Fragment>
        <JsonValue
          value={
            proof
              ? proof.events.find(event => event.kind === 'result')?.output
              : run?.output
          }
        />
      </Fragment>
    ),
    notebook: (
      <Fragment>
        {tab === 'notebook' &&
          (run?.notebookId ? (
            <NotebookPreview
              key={run.notebookId}
              investigationId={run.notebookId}
              workflowRunning={!run.done}
            />
          ) : (
            <Text>
              {run?.done
                ? t('This run ended before a notebook was created.')
                : t('Waiting for the notebook agent to open the notebook…')}
            </Text>
          ))}
      </Fragment>
    ),
    details: (
      <Fragment>
        {run && (
          <Stack gap="md" padding="md">
            <Heading as="h3">{run.status}</Heading>
            <Text>{run.id}</Text>
            <Text>
              {run.createdAt} {run.finishedAt && '→ ' + run.finishedAt}
            </Text>
            {Boolean(run.error) && <JsonValue value={run.error} />}
            {run.nodes.map(node => (
              <details key={node.id}>
                <summary>
                  {node.name} · {node.status} · {t('Attempt %s', node.attempt)}
                </summary>
                <JsonValue value={node} />
              </details>
            ))}
            <details>
              <summary>{t('Accepted workflow and input')}</summary>
              <JsonValue value={{workflow: run.workflow, input: run.input}} />
            </details>
          </Stack>
        )}
        {proof && <JsonValue value={proof} />}
      </Fragment>
    ),
    usage: (
      <Fragment>
        {run && (
          <Stack gap="sm" padding="md">
            <Heading as="h3">
              {t('%s tokens', run.usage.totalTokens.toLocaleString())}
            </Heading>
            <Text>{t('Total cost: $%s', run.usage.dollarCost.toFixed(4))}</Text>
            <JsonValue value={run.usage.usages} />
          </Stack>
        )}
      </Fragment>
    ),
  };
  return (
    <Tabs value={tab} onChange={onTabChange}>
      {({TabList, TabPanels}) => (
        <Fragment>
          <TabList>
            {keys.map(key => (
              <TabList.Item key={key}>{labels[key]}</TabList.Item>
            ))}
          </TabList>
          <TabPanels>
            {keys.map(key => (
              <TabPanels.Item key={key}>{panels[key]}</TabPanels.Item>
            ))}
          </TabPanels>
        </Fragment>
      )}
    </Tabs>
  );
}
