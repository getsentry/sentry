import {useMemo, useState} from 'react';
import sortBy from 'lodash/sortBy';
import {parseAsArrayOf, parseAsString, useQueryStates} from 'nuqs';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {
  AGENT_NAME_FIELDS,
  resolveAgentName,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {getHasAgentNameFilter} from 'sentry/views/insights/pages/agents/utils/query';
import {
  FilterUrlParams,
  TableUrlParams,
} from 'sentry/views/insights/pages/agents/utils/urlParams';

// Fetch the most active agents once and filter them client-side. EAP substring
// search on the agent-name attributes is unreliable, and this list is small
// enough that the built-in fuzzy search over the fetched options is a better fit.
const LIMIT = 100;

interface AgentSelectorProps {
  referrer: string;
}

export function AgentSelector({referrer}: AgentSelectorProps) {
  const organization = useOrganization();

  const [{agent: urlAgents}, setQueryStates] = useQueryStates(
    {
      [FilterUrlParams.AGENT]: parseAsArrayOf(parseAsString),
      [TableUrlParams.CURSOR]: parseAsString,
    },
    {history: 'replace'}
  );

  const selectedAgents = useMemo(() => urlAgents ?? [], [urlAgents]);

  const [orderAnchor, setOrderAnchor] = useState<string[]>(() => urlAgents ?? []);

  const {data: agentData, isPending} = useSpans(
    {
      limit: LIMIT,
      search: getHasAgentNameFilter(),
      sorts: [{field: 'count()', kind: 'desc'}],
      fields: [...AGENT_NAME_FIELDS, 'count()'],
    },
    referrer
  );

  const options = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{label: string; value: string}> = [];

    agentData?.forEach(row => {
      const agentName = resolveAgentName(row);
      if (!agentName || seen.has(agentName)) {
        return;
      }
      seen.add(agentName);
      list.push({label: agentName, value: agentName});
    });

    // Keep selected agents visible even when they aren't in the fetched results
    // (e.g. loaded from a saved query).
    selectedAgents.forEach(agent => {
      if (agent && !seen.has(agent)) {
        seen.add(agent);
        list.push({label: agent, value: agent});
      }
    });

    // Show the agents that were selected when the menu opened at the top of the
    // list, then sort each group alphabetically.
    const anchor = new Set(orderAnchor);
    return sortBy(list, [
      option => !anchor.has(option.value),
      option => option.label.toLowerCase(),
    ]);
  }, [agentData, selectedAgents, orderAnchor]);

  return (
    <CompactSelect
      multiple
      search
      style={{maxWidth: '200px'}}
      value={selectedAgents}
      options={options}
      emptyMessage={t('No agents found')}
      loading={isPending}
      menuTitle={t('Agent')}
      data-test-id="agent-selector"
      onOpenChange={isOpen => {
        if (isOpen) {
          setOrderAnchor(selectedAgents);
        }
      }}
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} prefix={t('Agent')} />
      )}
      onChange={newValue => {
        const values = newValue.map(v => v.value).filter(Boolean);
        setQueryStates({
          [FilterUrlParams.AGENT]: values.length > 0 ? values : null,
          [TableUrlParams.CURSOR]: null,
        });
        trackAnalytics('agent-monitoring.page-filter-change', {
          organization,
          filter: 'agent',
        });
      }}
    />
  );
}
