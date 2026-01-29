import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import debounce from 'lodash/debounce';
import {parseAsArrayOf, parseAsString, useQueryState, useQueryStates} from 'nuqs';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useCompactSelectOptionsCache} from 'sentry/views/insights/common/utils/useCompactSelectOptionsCache';
import {useWasSearchSpaceExhausted} from 'sentry/views/insights/common/utils/useWasSearchSpaceExhausted';
import {TableUrlParams} from 'sentry/views/insights/pages/agents/utils/urlParams';
import {SpanFields} from 'sentry/views/insights/types';

const LIMIT = 100;
const AGENT_URL_PARAM = 'agent';

export function useAgentFilters(): string[] {
  const [agentFilters] = useQueryState(AGENT_URL_PARAM, parseAsArrayOf(parseAsString));
  return agentFilters ?? [];
}

export function AgentSelector() {
  const organization = useOrganization();
  const pageFilters = usePageFilters();

  // Project-scoped storage key - automatically resets when projects change
  const projectKey = [...pageFilters.selection.projects].sort().join(',');
  const storageKey = `conversations:agent-filter:${organization.slug}:${projectKey}`;

  const [storedAgents, setStoredAgents] = useLocalStorageState<string[]>(storageKey, []);

  // Use nuqs to manage both agent and cursor state
  const [{agent: urlAgents}, setQueryStates] = useQueryStates(
    {
      [AGENT_URL_PARAM]: parseAsArrayOf(parseAsString),
      [TableUrlParams.CURSOR]: parseAsString,
    },
    {history: 'replace'}
  );

  // On mount: restore stored agents to URL if URL is empty
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true;
      if (!urlAgents?.length && storedAgents.length > 0) {
        setQueryStates({[AGENT_URL_PARAM]: storedAgents});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset when project changes
  const prevProjectKey = useRef(projectKey);
  useEffect(() => {
    if (prevProjectKey.current !== projectKey) {
      prevProjectKey.current = projectKey;
      setQueryStates({[AGENT_URL_PARAM]: null, [TableUrlParams.CURSOR]: null});
    }
  }, [projectKey, setQueryStates]);

  const selectedAgents = useMemo(() => {
    // Prevent cache pollution during project transitions
    if (prevProjectKey.current !== projectKey) {
      return [];
    }
    return urlAgents ?? [];
  }, [urlAgents, projectKey]);

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
        setStoredAgents(values);
        setQueryStates({
          [AGENT_URL_PARAM]: values.length > 0 ? values : null,
          [TableUrlParams.CURSOR]: null,
        });
      }}
    />
  );
}
