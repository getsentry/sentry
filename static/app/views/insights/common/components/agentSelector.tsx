import {useCallback, useMemo, useRef, useState} from 'react';
import {isAppleDevice} from '@react-aria/utils';
import sortBy from 'lodash/sortBy';
import {parseAsArrayOf, parseAsString, useQueryStates} from 'nuqs';

import {Badge} from '@sentry/scraps/badge';
import {CompactSelect, MenuComponents} from '@sentry/scraps/compactSelect';
import type {SelectOption} from '@sentry/scraps/compactSelect';
import {InfoTip} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {useStagedCompactSelect} from 'sentry/components/pageFilters/useStagedCompactSelect';
import {t, tct} from 'sentry/locale';
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

// Sentinel for the "All Agents" quick-select row. An empty selection already means
// "no agent filter", so this value never ends up in the URL.
const ALL_AGENTS_VALUE = '__all_agents__';

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
  const [stagedIsEmpty, setStagedIsEmpty] = useState(selectedAgents.length === 0);

  // Refs break the circular dependency between the options (which render
  // checkboxes that stage changes) and useStagedCompactSelect (which needs options).
  const toggleOptionRef = useRef<((val: string) => void) | undefined>(undefined);
  const dispatchRef = useRef<
    ReturnType<typeof useStagedCompactSelect<string>>['dispatch'] | undefined
  >(undefined);

  const {data: agentData, isPending} = useSpans(
    {
      limit: LIMIT,
      search: getHasAgentNameFilter(),
      sorts: [{field: 'count()', kind: 'desc'}],
      fields: [...AGENT_NAME_FIELDS, 'count()'],
    },
    referrer
  );

  const agentNames = useMemo(() => {
    const names = new Set<string>();

    agentData?.forEach(row => {
      const agentName = resolveAgentName(row);
      if (agentName) {
        names.add(agentName);
      }
    });

    // Keep selected agents visible even when they aren't in the fetched results
    // (e.g. loaded from a saved query).
    selectedAgents.forEach(agent => {
      if (agent) {
        names.add(agent);
      }
    });

    // Show the agents that were selected when the menu opened at the top of the
    // list, then sort each group alphabetically.
    const anchor = new Set(orderAnchor);
    return sortBy([...names], [name => !anchor.has(name), name => name.toLowerCase()]);
  }, [agentData, selectedAgents, orderAnchor]);

  const options = useMemo<Array<SelectOption<string>>>(() => {
    if (agentNames.length === 0) {
      return [];
    }

    return [
      {
        value: ALL_AGENTS_VALUE,
        label: t('All Agents'),
        textValue: t('All Agents'),
        leadingItems: () => (
          <MenuComponents.Checkbox
            checked={stagedIsEmpty}
            onChange={() => dispatchRef.current?.({type: 'set staged', value: []})}
            aria-label={t('Select All Agents')}
            tabIndex={-1}
          />
        ),
      },
      ...agentNames.map(name => ({
        value: name,
        label: name,
        leadingItems: ({isSelected}: {isSelected: boolean}) => (
          <MenuComponents.Checkbox
            checked={isSelected}
            onChange={() => toggleOptionRef.current?.(name)}
            aria-label={t('Select %s', name)}
            tabIndex={-1}
          />
        ),
      })),
    ];
    // oxlint-disable-next-line react/memo-dependencies
  }, [agentNames, stagedIsEmpty]);

  const handleChange = useCallback(
    (newValue: string[]) => {
      const values = newValue.includes(ALL_AGENTS_VALUE) ? [] : newValue.filter(Boolean);
      // The staged select commits on outside clicks and Escape even when nothing
      // changed. Skip those so dismissing the menu doesn't reset table pagination.
      if (new Set(values).symmetricDifference(new Set(selectedAgents)).size === 0) {
        return;
      }
      setQueryStates({
        [FilterUrlParams.AGENT]: values.length > 0 ? values : null,
        [TableUrlParams.CURSOR]: null,
      });
      trackAnalytics('agent-monitoring.page-filter-change', {
        organization,
        filter: 'agent',
      });
    },
    [organization, selectedAgents, setQueryStates]
  );

  const handleStagedValueChange = useCallback((staged: string[]) => {
    // Cmd/Ctrl- or shift-clicking the "All Agents" row stages the sentinel next to
    // real agents. Collapse that to an empty selection, which means "all agents".
    if (staged.includes(ALL_AGENTS_VALUE)) {
      dispatchRef.current?.({type: 'set staged', value: []});
    }
    setStagedIsEmpty(staged.length === 0);
  }, []);

  const stagedSelect = useStagedCompactSelect({
    value: selectedAgents,
    options,
    onChange: handleChange,
    onStagedValueChange: handleStagedValueChange,
    multiple: true,
  });

  // oxlint-disable-next-line react/refs
  toggleOptionRef.current = stagedSelect.toggleOption;
  // oxlint-disable-next-line react/refs
  dispatchRef.current = stagedSelect.dispatch;

  const hasStagedChanges =
    new Set(stagedSelect.value).symmetricDifference(new Set(selectedAgents)).size > 0;

  // CompactSelect disables itself when there are no options, so the empty
  // message is never visible. Explain why on the disabled trigger instead.
  const disabledReason =
    !isPending && options.length === 0
      ? t('No agents found for the selected projects, environments, and date range.')
      : undefined;

  return (
    <CompactSelect
      mode="grid"
      multiple
      {...stagedSelect.compactSelectProps}
      style={{maxWidth: '200px'}}
      emptyMessage={t('No agents found')}
      loading={isPending}
      menuTitle={
        <Flex gap="xs" align="center">
          <Text>{t('Agent')}</Text>
          <InfoTip
            size="xs"
            title={tct(
              '[rangeModifier] + click to select a range of agents or [multiModifier] + click to select multiple agents at once.',
              {
                rangeModifier: t('Shift'),
                multiModifier: isAppleDevice() ? t('Cmd') : t('Ctrl'),
              }
            )}
          />
        </Flex>
      }
      data-test-id="agent-selector"
      onOpenChange={isOpen => {
        stagedSelect.compactSelectProps.onOpenChange?.(isOpen);
        if (isOpen) {
          setOrderAnchor(selectedAgents);
        }
      }}
      menuHeaderTrailingItems={
        stagedSelect.value.length > 0 ? (
          <MenuComponents.ResetButton
            onClick={() => {
              stagedSelect.dispatch({type: 'remove staged'});
              handleChange([]);
            }}
          />
        ) : null
      }
      menuFooter={
        hasStagedChanges ? (
          <Flex gap="md" align="center" justify="end">
            <MenuComponents.CancelButton
              onClick={() => stagedSelect.dispatch({type: 'remove staged'})}
            />
            <MenuComponents.ApplyButton
              onClick={() => {
                stagedSelect.dispatch({type: 'remove staged'});
                handleChange(stagedSelect.value);
              }}
            />
          </Flex>
        ) : null
      }
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          tooltipProps={{title: disabledReason}}
          prefix={selectedAgents.length === 0 ? undefined : t('Agent')}
        >
          {/* Label from the committed selection, not CompactSelect's staged value,
              so the trigger only changes once the selection is applied. */}
          {selectedAgents.length === 0 ? (
            t('All Agents')
          ) : (
            <Flex align="center" gap="xs" minWidth="0">
              <Text ellipsis>{selectedAgents[0]}</Text>
              {selectedAgents.length > 1 && (
                <Badge variant="muted">{`+${selectedAgents.length - 1}`}</Badge>
              )}
            </Flex>
          )}
        </OverlayTrigger.Button>
      )}
    />
  );
}
