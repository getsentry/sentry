import {parseAsString, useQueryState} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';

import {AGENT_TAG, getImpactDisplay} from './agentFeedback';
import {useAgentFeedbackTagCounts, useAgentToolStats} from './useAgentToolStats';

const MAX_TOOLS = 6;
const TOOL_COLUMNS = [
  {key: 'tool'},
  {key: 'reports', width: 72},
  {key: 'calls', width: 64},
  {key: 'failed', width: 64},
];

/**
 * Triage for agent feedback: which tools agents complain about, weighed
 * against how much those tools are called and how often they fail.
 */
export function AgentFeedbackBreakdown() {
  const [isExpanded, setIsExpanded] = useSyncedLocalStorageState(
    'agent-feedback-breakdown-expanded',
    true
  );
  const [query, setQuery] = useQueryState('query', parseAsString.withDefault(''));

  const {counts: toolCounts} = useAgentFeedbackTagCounts(AGENT_TAG.tool);
  const {counts: impactCounts} = useAgentFeedbackTagCounts(AGENT_TAG.impact);

  const topTools = toolCounts.slice(0, MAX_TOOLS);
  const {statsByTool} = useAgentToolStats({tools: topTools.map(({value}) => value)});

  // Only projects that receive agent feedback have these tags.
  if (!toolCounts.length) {
    return null;
  }

  const search = new MutableSearch(query);
  const activeTool = search.getFilterValues(AGENT_TAG.tool)[0];
  const activeImpact = search.getFilterValues(AGENT_TAG.impact)[0];

  const toggleFilter = (key: string, value: string, isActive: boolean) => {
    const next = new MutableSearch(query);
    if (isActive) {
      next.removeFilter(key);
    } else {
      next.setFilterValues(key, [value]);
    }
    setQuery(next.formatString() || null);
  };

  return (
    <Container padding="md" border="primary" radius="md">
      <Disclosure
        expanded={isExpanded}
        onExpandedChange={setIsExpanded}
        size="md"
        as="section"
      >
        <Disclosure.Title>{t('Agent Reports by Tool')}</Disclosure.Title>
        <Disclosure.Content>
          <Stack gap="md" width="100%">
            <Flex gap="sm" wrap="wrap">
              {impactCounts.map(({value, count}) => {
                const isActive = activeImpact === value;
                return (
                  <Button
                    key={value}
                    size="xs"
                    variant={isActive ? 'primary' : 'secondary'}
                    aria-pressed={isActive}
                    onClick={() => toggleFilter(AGENT_TAG.impact, value, isActive)}
                  >
                    {getImpactDisplay(value).label} {count}
                  </Button>
                );
              })}
            </Flex>

            <SimpleTable
              density="compressed"
              columns={TOOL_COLUMNS}
              header={
                <SimpleTable.HeaderRow>
                  <SimpleTable.HeaderCell>{t('Tool')}</SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell align="right">
                    {t('Reports')}
                  </SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell align="right">
                    {t('Calls')}
                  </SimpleTable.HeaderCell>
                  <SimpleTable.HeaderCell align="right">
                    {t('Failed')}
                  </SimpleTable.HeaderCell>
                </SimpleTable.HeaderRow>
              }
            >
              {topTools.map(({value: tool, count}) => {
                const stats = statsByTool.get(tool);
                const isActive = activeTool === tool;
                return (
                  <SimpleTable.Row key={tool}>
                    <SimpleTable.RowCell>
                      <Button
                        size="zero"
                        variant="link"
                        aria-pressed={isActive}
                        onClick={() => toggleFilter(AGENT_TAG.tool, tool, isActive)}
                      >
                        <Text size="sm" monospace bold={isActive} variant="inherit">
                          {tool}
                        </Text>
                      </Button>
                    </SimpleTable.RowCell>
                    <SimpleTable.RowCell justify="end">
                      <Text size="sm" tabular>
                        {count}
                      </Text>
                    </SimpleTable.RowCell>
                    <SimpleTable.RowCell justify="end">
                      <Text size="sm" tabular variant="muted">
                        {stats ? formatAbbreviatedNumber(stats.calls) : '—'}
                      </Text>
                    </SimpleTable.RowCell>
                    <SimpleTable.RowCell justify="end">
                      <Text
                        size="sm"
                        tabular
                        variant={stats && stats.failureRate >= 0.05 ? 'danger' : 'muted'}
                      >
                        {stats ? formatPercentage(stats.failureRate, 1) : '—'}
                      </Text>
                    </SimpleTable.RowCell>
                  </SimpleTable.Row>
                );
              })}
            </SimpleTable>
          </Stack>
        </Disclosure.Content>
      </Disclosure>
    </Container>
  );
}
