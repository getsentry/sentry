import {useCallback, useMemo, useState} from 'react';
import debounce from 'lodash/debounce';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import {decodeList} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useCompactSelectOptionsCache} from 'sentry/views/insights/common/utils/useCompactSelectOptionsCache';
import {useWasSearchSpaceExhausted} from 'sentry/views/insights/common/utils/useWasSearchSpaceExhausted';
import {TableUrlParams} from 'sentry/views/insights/pages/agents/utils/urlParams';
import {SpanFields} from 'sentry/views/insights/types';

const LIMIT = 100;
const AGENT_URL_PARAM = 'agent';

export function AgentSelector() {
  const navigate = useNavigate();
  const location = useLocation();
  const pageFilters = usePageFilters();
  const {agent: selectedAgents = []} = useLocationQuery({
    fields: {agent: decodeList},
  });

  const [searchQuery, setSearchQuery] = useState<string>('');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSetSearch = useCallback(
    debounce(newSearch => {
      setSearchQuery(newSearch);
    }, 500),
    []
  );

  const query = useMemo(() => {
    const parts = [`has:${SpanFields.GEN_AI_AGENT_NAME}`];
    if (searchQuery) {
      parts.push(`${SpanFields.GEN_AI_AGENT_NAME}:*${searchQuery}*`);
    }
    return parts.join(' ');
  }, [searchQuery]);

  const {
    data: agentData,
    isPending,
    pageLinks,
  } = useSpans(
    {
      limit: LIMIT,
      search: query,
      sorts: [{field: 'count()', kind: 'desc'}],
      fields: [SpanFields.GEN_AI_AGENT_NAME, 'count()'],
    },
    'api.insights.conversations.get-agent-names'
  );

  const wasSearchSpaceExhausted = useWasSearchSpaceExhausted({
    query: searchQuery,
    isLoading: isPending,
    pageLinks,
  });

  const agentList = useMemo(() => {
    const uniqueAgents = new Set<string>();
    const list: Array<{label: string; value: string}> = [];

    agentData?.forEach(row => {
      const agentName = row[SpanFields.GEN_AI_AGENT_NAME];
      if (!agentName || typeof agentName !== 'string' || uniqueAgents.has(agentName)) {
        return;
      }
      uniqueAgents.add(agentName);
      list.push({label: agentName, value: agentName});
    });

    // Ensure selected values are in the list
    selectedAgents.forEach(agent => {
      if (agent && !uniqueAgents.has(agent)) {
        list.push({label: agent, value: agent});
      }
    });

    return list;
  }, [agentData, selectedAgents]);

  const cacheKey = [...pageFilters.selection.projects].sort().join(' ');
  const {options} = useCompactSelectOptionsCache(agentList, cacheKey);

  return (
    <CompactSelect
      multiple
      style={{maxWidth: '200px'}}
      value={selectedAgents}
      options={options}
      emptyMessage={t('No agents found')}
      loading={isPending}
      searchable
      menuTitle={t('Agent')}
      data-test-id="agent-selector"
      onSearch={newValue => {
        if (!wasSearchSpaceExhausted) {
          debouncedSetSearch(newValue);
        }
      }}
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} prefix={t('Agent')} />
      )}
      onChange={newValue => {
        const values = newValue.map(v => v.value).filter(Boolean);
        navigate({
          ...location,
          query: {
            ...location.query,
            [AGENT_URL_PARAM]: values.length > 0 ? values : undefined,
            [TableUrlParams.CURSOR]: undefined,
          },
        });
      }}
    />
  );
}
