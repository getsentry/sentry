import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';
import {parseAsArrayOf, parseAsString, useQueryStates} from 'nuqs';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import localStorage from 'sentry/utils/localStorage';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useCompactSelectOptionsCache} from 'sentry/views/insights/common/utils/useCompactSelectOptionsCache';
import {useWasSearchSpaceExhausted} from 'sentry/views/insights/common/utils/useWasSearchSpaceExhausted';
import {TableUrlParams} from 'sentry/views/insights/pages/agents/utils/urlParams';
import {SpanFields} from 'sentry/views/insights/types';

const LIMIT = 100;
const AGENT_URL_PARAM = 'agent';

function makeAgentFilterStorageKey(orgSlug: string): string {
  return `conversations:agent-filter:${orgSlug}`;
}

function getAgentFilterFromStorage(orgSlug: string): string[] {
  const value = localStorage.getItem(makeAgentFilterStorageKey(orgSlug));
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function AgentSelector() {
  const organization = useOrganization();
  const pageFilters = usePageFilters();

  // Use nuqs to manage both agent and cursor state
  const [{agent: selectedAgents}, setQueryStates] = useQueryStates(
    {
      [AGENT_URL_PARAM]: parseAsArrayOf(parseAsString),
      [TableUrlParams.CURSOR]: parseAsString,
    },
    {history: 'replace'}
  );

  // Initialize from localStorage on mount if URL is empty
  const hasInitialized = useRef(false);
  useEffect(() => {
    if (!hasInitialized.current && !selectedAgents) {
      const storedAgents = getAgentFilterFromStorage(organization.slug);
      if (storedAgents.length > 0) {
        setQueryStates({[AGENT_URL_PARAM]: storedAgents});
      }
      hasInitialized.current = true;
    }
  }, [selectedAgents, organization.slug, setQueryStates]);

  // Sync to localStorage whenever agents change
  useEffect(() => {
    const agents = selectedAgents ?? [];
    if (agents.length > 0) {
      localStorage.setItem(
        makeAgentFilterStorageKey(organization.slug),
        JSON.stringify(agents)
      );
    } else {
      localStorage.removeItem(makeAgentFilterStorageKey(organization.slug));
    }
  }, [selectedAgents, organization.slug]);

  // Reset agent filter when project changes
  const prevProjectsRef = useRef<number[]>(pageFilters.selection.projects);
  useEffect(() => {
    const currentProjects = pageFilters.selection.projects;
    const prevProjects = prevProjectsRef.current;

    const projectsChanged = !isEqual(prevProjects, currentProjects);

    if (projectsChanged) {
      // Clear agent filter from URL and localStorage
      localStorage.removeItem(makeAgentFilterStorageKey(organization.slug));
      setQueryStates({
        [AGENT_URL_PARAM]: null,
        [TableUrlParams.CURSOR]: null,
      });

      // Update ref for next comparison
      prevProjectsRef.current = currentProjects;
    }
  }, [pageFilters.selection.projects, setQueryStates, organization.slug]);

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
    (selectedAgents ?? []).forEach(agent => {
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
      value={selectedAgents ?? []}
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

        // Update URL and clear pagination cursor
        // localStorage sync happens in useEffect
        setQueryStates({
          [AGENT_URL_PARAM]: values.length > 0 ? values : null,
          [TableUrlParams.CURSOR]: null,
        });
      }}
    />
  );
}
