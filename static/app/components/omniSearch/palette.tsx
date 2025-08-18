import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import styled from '@emotion/styled';
import * as CommandPrimitive from 'cmdk';

import {closeModal} from 'sentry/actionCreators/modal';
import {useOmniActions} from 'sentry/components/omniSearch/useOmniActions';
import {useOmniSearchState} from 'sentry/components/omniSearch/useOmniSearchState';
import {
  createDocIntegrationResults,
  createIntegrationResults,
  createMemberResults,
  createPluginResults,
  createProjectResults,
  createSentryAppResults,
  createTeamResults,
  queryResults,
} from 'sentry/components/search/sources/apiSource';
import type {ResultItem} from 'sentry/components/search/sources/types';
import {strGetFn} from 'sentry/components/search/sources/utils';
import {IconDocs} from 'sentry/icons';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {createFuzzySearch} from 'sentry/utils/fuzzySearch';
import useApi from 'sentry/utils/useApi';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import useOrganization from 'sentry/utils/useOrganization';

import type {OmniAction} from './types';

/**
 * Very basic palette UI using cmdk that lists all registered actions.
 *
 * NOTE: This is intentionally minimal and will be iterated on.
 */
export function OmniSearchPalette() {
  const {
    focusedArea,
    actions: availableActions,
    selectedAction,
    selectAction,
    clearSelection,
  } = useOmniSearchState();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const api = useApi();
  const organization = useOrganization({allowNull: true});

  const [results, setResults] = useState<ResultItem[]>([]);

  const debouncedQuery = useDebouncedValue(query, 300);

  const handleSearch = useCallback(async () => {
    const pendingResults: Array<Promise<ResultItem[] | null>> = [];

    if (organization) {
      const org = organization;
      const slug = organization.slug;

      const q = (url: string) => queryResults(api, url, debouncedQuery);

      const searchQueries = [
        createProjectResults(q(`/organizations/${slug}/projects/`), org),
        createTeamResults(q(`/organizations/${slug}/teams/`), org),
        createMemberResults(q(`/organizations/${slug}/members/`), org),
        createPluginResults(q(`/organizations/${slug}/plugins/configs/`), org),
        createIntegrationResults(q(`/organizations/${slug}/config/integrations/`), org),
        createSentryAppResults(q('/sentry-apps/?status=published'), org),
        createDocIntegrationResults(q('/doc-integrations/'), org),
      ];
      pendingResults.push(...searchQueries);
    }

    const resolvedResults = await Promise.all(pendingResults);
    setResults(resolvedResults.flat().filter(i => i !== null));
  }, [api, debouncedQuery, organization]);

  useEffect(() => {
    void handleSearch();
  }, [handleSearch]);

  const dynamicActions = useMemo(() => {
    const actions: OmniAction[] = [];
    if (query) {
      results.forEach((result, index) => {
        actions.push({
          key: `api-${index}`,
          areaKey: 'navigate',
          label: result.title as string,
          actionIcon: <IconDocs />,
          onAction: () => {
            if (typeof result.to === 'string') {
              window.open(result.to, '_blank', 'noreferrer');
            }
          },
        });
      });
    }

    return actions.slice(0, 10);
  }, [results, query]);

  useOmniActions(dynamicActions);

  const [filteredAvailableActions, setFilteredAvailableActions] = useState<OmniAction[]>(
    []
  );

  useEffect(() => {
    createFuzzySearch(availableActions, {
      keys: ['label', 'fullLabel', 'details'],
      getFn: strGetFn,
    }).then(f => {
      setFilteredAvailableActions(f.search(debouncedQuery).map(r => r.item));
    });
  }, [availableActions, debouncedQuery]);

  const grouped = useMemo(() => {
    // const actions = availableActions.filter((a: OmniAction) => !a.hidden);
    const actions = debouncedQuery ? filteredAvailableActions : availableActions;

    // Group by section label
    const bySection = new Map<string, OmniAction[]>();
    for (const action of actions) {
      const sectionLabel = action.section ?? '';
      const list = bySection.get(sectionLabel) ?? [];
      list.push(action);
      bySection.set(sectionLabel, list);
    }

    // Sort sections alphabetically by label
    const sectionKeys = Array.from(bySection.keys()).sort((a, b) => a.localeCompare(b));

    return sectionKeys.map(sectionKey => {
      const label = sectionKey;
      const items = (bySection.get(sectionKey) ?? []).sort((a, b) =>
        a.label.localeCompare(b.label)
      );
      return {sectionKey, label, items};
    });
  }, [availableActions, debouncedQuery, filteredAvailableActions]);

  const handleSelect = (action: OmniAction) => {
    if (action.disabled) {
      return;
    }
    if (action.children && action.children.length > 0) {
      selectAction(action);
      return;
    }
    if (action.onAction) {
      action.onAction();
    }
    if (action.to) {
      navigate(action.to);
    }

    // TODO: Any other action handlers?

    if (!action.keepOpen) {
      closeModal();
    }
  };

  // When an action has been selected, clear the query and focus the input
  useEffect(() => {
    if (selectedAction) {
      setQuery('');
      inputRef.current?.focus();
    }
  }, [selectedAction]);

  return (
    <Container>
      <CommandPrimitive.Command label="OmniSearch" shouldFilter={false}>
        <Header>
          {focusedArea && <div>{focusedArea.label}</div>}
          <CommandPrimitive.Command.Input
            ref={inputRef}
            autoFocus
            value={query}
            onValueChange={setQuery}
            onKeyDown={e => {
              if (e.key === 'Backspace' && query === '' && selectedAction) {
                clearSelection();
                e.preventDefault();
              }
            }}
            placeholder="Start typing…"
          />
        </Header>
        <CommandPrimitive.Command.List>
          {grouped.every(g => g.items.length === 0) ? (
            <CommandPrimitive.Command.Empty>No results</CommandPrimitive.Command.Empty>
          ) : (
            grouped.map(group => (
              <Fragment key={group.sectionKey}>
                {group.items.length > 0 && (
                  <CommandPrimitive.Command.Group heading={group.label}>
                    {group.items.map(item => (
                      <CommandPrimitive.Command.Item
                        key={item.key}
                        onSelect={() => handleSelect(item)}
                        disabled={item.disabled}
                      >
                        <ItemRow>
                          {item.actionIcon && (
                            <IconDefaultsProvider size="sm">
                              {item.actionIcon}
                            </IconDefaultsProvider>
                          )}
                          <span>{item.label}</span>
                        </ItemRow>
                      </CommandPrimitive.Command.Item>
                    ))}
                  </CommandPrimitive.Command.Group>
                )}
              </Fragment>
            ))
          )}
        </CommandPrimitive.Command.List>
      </CommandPrimitive.Command>
    </Container>
  );
}

const Container = styled('div')`
  width: 640px;
  max-width: 100%;
`;

const Header = styled('div')`
  padding: 8px;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const ItemRow = styled('div')`
  display: flex;
  gap: 8px;
  align-items: center;
`;

export default OmniSearchPalette;
