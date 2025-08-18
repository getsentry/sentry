import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useMemo,
  useState,
  useState,
} from 'react';
import {useNavigate} from 'react-router-dom';
import styled from '@emotion/styled';
import styled from '@emotion/styled';
import * as CommandPrimitive from 'cmdk';
import * as CommandPrimitive from 'cmdk';

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
import {createFuzzySearch, type Fuse} from 'sentry/utils/fuzzySearch';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import {useOmniSearchStore} from './context';
import type {OmniAction} from './types';

/**
 * Very basic palette UI using cmdk that lists all registered actions.
 *
 * NOTE: This is intentionally minimal and will be iterated on.
 */
export function OmniSearchPalette() {
  const {areasByKey, areaPriority} = useOmniSearchStore();
  const {focusedArea, actions: availableActions} = useOmniSearchState();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const api = useApi();
  const organization = useOrganization({allowNull: true});

  const [results, setResults] = useState<ResultItem[]>([]);
  const [fuzzyResults, setFuzzyResults] = useState<Array<Fuse.FuseResult<ResultItem>>>(
    []
  );

  const handleSearch = useCallback(async () => {
    const pendingResults: Array<Promise<ResultItem[] | null>> = [];

    if (organization) {
      const org = organization;
      const slug = organization.slug;

      const q = (url: string) => queryResults(api, url, query);

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
  }, [api, query, organization]);

  const handleFuzzySearch = useCallback(async () => {
    const fuzzy = await createFuzzySearch(results, {
      keys: ['title', 'description', 'model.id', 'model.shortId'],
      getFn: strGetFn,
    });
    setFuzzyResults(fuzzy.search(query));
  }, [results, query]);

  useEffect(() => {
    void handleSearch();
  }, [handleSearch]);

  useEffect(() => {
    void handleFuzzySearch();
  }, [handleFuzzySearch]);

  const dynamicActions = useMemo(() => {
    const actions: OmniAction[] = [];

    // Add actual results that match the query (case-insensitive)
    if (query) {
      const actualMatches = results.filter(result => {
        if (!result.to || typeof result.title !== 'string') {
          return false;
        }
        const titleMatch = result.title.toLowerCase().includes(query.toLowerCase());
        const descriptionMatch =
          result.description &&
          typeof result.description === 'string' &&
          result.description.toLowerCase().includes(query.toLowerCase());
        return titleMatch || descriptionMatch;
      });

      actualMatches.forEach((result, index) => {
        actions.push({
          key: `actual-${index}`,
          areaKey: 'navigate',
          label: result.title as string,
          actionIcon: IconDocs,
          onAction: () => {
            if (typeof result.to === 'string') {
              window.open(result.to, '_blank', 'noreferrer');
            }
          },
        });
      });
    }

    // Add fuzzy results
    fuzzyResults
      .filter(result => result.item.to && typeof result.item.title === 'string')
      .forEach((result, index) => {
        actions.push({
          key: `fuzzy-${index}`,
          areaKey: 'navigate',
          label: result.item.title as string,
          actionIcon: IconDocs,
          onAction: () => {
            if (typeof result.item.to === 'string') {
              window.open(result.item.to, '_blank', 'noreferrer');
            }
          },
        });
      });

    return actions.slice(0, 10);
  }, [fuzzyResults, results, query]);

  useOmniActions(dynamicActions);

  const grouped = useMemo(() => {
    const actions = availableActions.filter(a => !a.hidden);

    const byArea = new Map<string, OmniAction[]>();
    for (const action of actions) {
      const list = byArea.get(action.areaKey) ?? [];
      list.push(action);
      byArea.set(action.areaKey, list);
    }

    const sortAreaKeys = () => {
      const existingKeys = new Set(byArea.keys());
      const prioritized = areaPriority.filter(k => existingKeys.has(k));
      const remaining = Array.from(existingKeys).filter(k => !prioritized.includes(k));
      remaining.sort((a, b) => {
        const aLabel = areasByKey.get(a)?.label ?? a;
        const bLabel = areasByKey.get(b)?.label ?? b;
        return aLabel.localeCompare(bLabel);
      });
      return [...prioritized, ...remaining];
    };

    const areaKeys = sortAreaKeys();

    return areaKeys.map(areaKey => {
      const label = areasByKey.get(areaKey)?.label ?? areaKey;
      const items = (byArea.get(areaKey) ?? []).sort((a, b) =>
        a.label.localeCompare(b.label)
      );
      return {areaKey, label, items};
    });
  }, [availableActions, areasByKey, areaPriority]);

  const handleSelect = (action: OmniAction) => {
    if (action.disabled) {
      return;
    }
    if (action.onAction) {
      action.onAction();
    }
    if (action.to) {
      navigate(action.to);
    }

    // TODO: Any other action handlers?
  };

  return (
    <Container>
      <CommandPrimitive.Command label="OmniSearch" shouldFilter={false}>
        <Header>
          {focusedArea && <div>{focusedArea.label}</div>}
          <CommandPrimitive.Command.Input
            autoFocus
            value={query}
            onValueChange={setQuery}
            placeholder="Start typing…"
          />
        </Header>
        <CommandPrimitive.Command.List>
          {grouped.length === 0 ? (
            <CommandPrimitive.Command.Empty>No results</CommandPrimitive.Command.Empty>
          ) : (
            grouped.map(group => (
              <CommandPrimitive.Command.Group key={group.areaKey} heading={group.label}>
                {group.items.map(item => (
                  <CommandPrimitive.Command.Item
                    key={item.key}
                    onSelect={() => handleSelect(item)}
                    disabled={item.disabled}
                  >
                    <ItemRow>
                      {item.actionIcon && <item.actionIcon size="sm" />}
                      <span>{item.label}</span>
                    </ItemRow>
                  </CommandPrimitive.Command.Item>
                ))}
              </CommandPrimitive.Command.Group>
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
