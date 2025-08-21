import {
  Fragment,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled from '@emotion/styled';
import * as CommandPrimitive from 'cmdk';
import serryLottieAnimation from 'getsentry-images/omni_search/seer-y.json';
import {PlatformIcon} from 'platformicons';

import error from 'sentry-images/spot/cmd-k-error.svg';

import {closeModal} from 'sentry/actionCreators/modal';
import {Tag} from 'sentry/components/core/badge/tag';
import SeeryCharacter, {
  type SeeryCharacterRef,
} from 'sentry/components/omniSearch/animation/seeryCharacter';
import {SEER_ANIMATION_EXIT_DURATION} from 'sentry/components/omniSearch/constants';
import {useOmniSearchStore} from 'sentry/components/omniSearch/context';
import {SeerSearchAnimation} from 'sentry/components/omniSearch/seerSearchAnimation';
import {strGetFn} from 'sentry/components/search/sources/utils';
import {IconArrow} from 'sentry/icons/iconArrow';
import {IconBot} from 'sentry/icons/iconBot';
import {IconDefaultsProvider} from 'sentry/icons/useIconDefaults';
import {createFuzzySearch} from 'sentry/utils/fuzzySearch';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useSeenIssues} from 'sentry/utils/seenIssuesStorage';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useTraceExploreAiQuerySetup} from 'sentry/views/explore/hooks/useTraceExploreAiQuerySetup';
import {getExploreUrl} from 'sentry/views/explore/utils';

import brainhead from './brainhead.png';
import type {OmniAction} from './types';
import {useApiDynamicActions} from './useApiDynamicActions';
import {useCommandDynamicActions} from './useCommandDynamicActions';
import {useFormDynamicActions} from './useFormDynamicActions';
import {useOmniSearchState} from './useOmniSearchState';
import {useOrganizationsDynamicActions} from './useOrganizationsDynamicActions';
import {useRouteDynamicActions} from './useRouteDynamicActions';

type TranslateResponse = {
  environments: string[];
  query: string;
  route: 'issues';
  sort: string;
  statsPeriod: string;
};

/**
 * Recursively flattens an array of actions, including all their children
 * Child actions will have their labels prefixed with parent title and arrow
 */
function flattenActions(actions: OmniAction[], parentLabel?: string): OmniAction[] {
  const flattened: OmniAction[] = [];

  for (const action of actions) {
    // For child actions, prefix with parent label
    if (parentLabel) {
      flattened.push({
        ...action,
        label: `${parentLabel} → ${action.label}`,
      });
    } else {
      // For top-level actions, add them as-is
      flattened.push(action);
    }

    if (action.children && action.children.length > 0) {
      // Use the original action label (not the prefixed one) as parent context
      const childParentLabel = parentLabel
        ? `${parentLabel} → ${action.label}`
        : action.label;
      flattened.push(...flattenActions(action.children, childParentLabel));
    }
  }

  return flattened;
}

export interface OmniSearchPaletteSeeryRef {
  triggerSeeryBarrelRoll: () => void;
  triggerSeeryCelebrate: () => void;
  triggerSeeryError: () => void;
  triggerSeeryImpatient: () => void;
  triggerSeerySearchDone: () => void;
  triggerSeeryWatching: () => void;
}

/**
 * Very basic palette UI using cmdk that lists all registered actions.
 *
 * NOTE: This is intentionally minimal and will be iterated on.
 */
interface OmniSearchPaletteProps {
  ref?: React.Ref<OmniSearchPaletteSeeryRef>;
}

export function OmniSearchPalette({ref}: OmniSearchPaletteProps) {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const {projects} = useProjects();
  const memberProjects = projects.filter(p => p.isMember);
  const {isSearchingSeer, setIsSearchingSeer} = useOmniSearchStore();
  const {
    focusedArea,
    actions: availableActions,
    selectedAction,
    selectAction,
    clearSelection,
  } = useOmniSearchState();
  const [query, setQuery] = useState('');
  const [seerError, setSeerError] = useState<boolean>(false);
  const [seerIsExiting, setSeerIsExiting] = useState<boolean>(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const seeryRef = useRef<SeeryCharacterRef>(null);

  const debouncedQuery = useDebouncedValue(query, 300);

  const {getSeenIssues} = useSeenIssues();
  const {groupId} = useParams();

  useTraceExploreAiQuerySetup({enableAISearch: true});

  // Get ALL seen issues (no limit here)
  const allRecentIssueActions: OmniAction[] = useMemo(() => {
    return getSeenIssues()
      .filter(issue => groupId !== issue.issue.id)
      .map(issue => ({
        key: `recent-issue-${issue.id}`,
        areaKey: 'recent',
        section: 'Recently Viewed',
        label: issue.issue.title || issue.issue.id,
        actionIcon: <PlatformIcon platform={issue.issue.platform} size={16} />,
        to: `/organizations/${organization.slug}/issues/${issue.id}/`,
      }));
  }, [getSeenIssues, groupId, organization.slug]);

  // Get dynamic actions from all sources (no filtering - palette handles the search)
  const apiActions = useApiDynamicActions(debouncedQuery);
  const formActions = useFormDynamicActions();
  const routeActions = useRouteDynamicActions();
  const orgActions = useOrganizationsDynamicActions();
  const commandActions = useCommandDynamicActions();

  // Store the current query in a ref so we can access it in the callback
  const currentQueryRef = useRef<string>('');
  currentQueryRef.current = debouncedQuery;

  // Create Ask Seer action with dynamic label
  const askSeerAction = useMemo<OmniAction>(() => {
    // Create base action without label dependency
    const baseAction: OmniAction = {
      key: 'ask-seer',
      label: '',
      areaKey: 'navigate',
      actionIcon: <IconBot />,
      section: '', // Empty section so it appears at the top
      keepOpen: true,
      onAction: async () => {
        const queryToSearch = currentQueryRef.current;
        if (!queryToSearch) {
          return;
        }
        setIsSearchingSeer(true);
        triggerSeeryCelebrate();

        try {
          const url = 'https://cmdkllm-12459da2e71a.herokuapp.com/ask-seer';
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query: queryToSearch,
            }),
          });
          const data: {route: 'traces' | 'issues' | 'other'} = await res.json();

          if (data.route === 'traces') {
            try {
              const selectedProjects =
                pageFilters.selection.projects?.length > 0 &&
                pageFilters.selection.projects?.[0] !== -1
                  ? pageFilters.selection.projects
                  : memberProjects.map(p => p.id);

              const response: any = await fetchMutation({
                url: `/organizations/${organization.slug}/trace-explorer-ai/query/`,
                method: 'POST',
                data: {
                  natural_language_query: queryToSearch,
                  project_ids: selectedProjects,
                  limit: 1,
                },
              });

              if (response.queries && response.queries.length > 0) {
                const result = response.queries[0];
                const startFilter = pageFilters.selection.datetime.start?.valueOf();
                const start = startFilter
                  ? new Date(startFilter).toISOString()
                  : pageFilters.selection.datetime.start;

                const endFilter = pageFilters.selection.datetime.end?.valueOf();
                const end = endFilter
                  ? new Date(endFilter).toISOString()
                  : pageFilters.selection.datetime.end;

                const selection = {
                  ...pageFilters.selection,
                  datetime: {
                    start,
                    end,
                    utc: pageFilters.selection.datetime.utc,
                    period: result.stats_period || pageFilters.selection.datetime.period,
                  },
                };

                const mode =
                  result.group_by.length > 0
                    ? Mode.AGGREGATE
                    : result.mode === 'aggregates'
                      ? Mode.AGGREGATE
                      : Mode.SAMPLES;

                const visualize =
                  result.visualization?.map((v: any) => ({
                    chartType: v?.chart_type,
                    yAxes: v?.y_axes,
                  })) ?? [];

                const exploreUrl = getExploreUrl({
                  organization,
                  selection,
                  query: result.query,
                  visualize,
                  groupBy: result.group_by ?? [],
                  sort: result.sort,
                  mode,
                });

                setIsSearchingSeer(false);
                setSeerIsExiting(true);

                // Wait slightly to let the animation finish
                setTimeout(() => {
                  closeModal();
                  navigate(exploreUrl);
                }, SEER_ANIMATION_EXIT_DURATION);
              }
            } catch (_error) {
              // Fallback to basic explore page if AI query fails
              const exploreUrl = getExploreUrl({
                organization,
                selection: pageFilters.selection,
                query: queryToSearch,
                visualize: [],
                groupBy: [],
                sort: '',
                mode: Mode.SAMPLES,
              });

              setIsSearchingSeer(false);
              setSeerIsExiting(true);

              // Wait slightly to let the animation finish
              setTimeout(() => {
                closeModal();
                navigate(exploreUrl);
              }, SEER_ANIMATION_EXIT_DURATION);
            }
          } else if (data.route === 'issues') {
            const response = data as TranslateResponse;
            const environmentsParam =
              response.environments && response.environments.length > 0
                ? `&environments=${response.environments.join(',')}`
                : '';

            setIsSearchingSeer(false);
            setSeerIsExiting(true);

            // Wait slightly to let the animation finish
            setTimeout(() => {
              closeModal();
              navigate(
                `/organizations/${organization.slug}/issues?query=${response.query}&statsPeriod=${response.statsPeriod}&sort=${response.sort}${environmentsParam}`
              );
            }, SEER_ANIMATION_EXIT_DURATION);
          } else {
            closeModal();
          }
        } catch (err) {
          setSeerError(true);
        } finally {
          setIsSearchingSeer(false);
        }
      },
    };

    // Return action with dynamic label
    return {
      ...baseAction,
      label: query ? `Ask Seer: "${query}"` : 'Ask Seer',
    };
  }, [
    query,
    setIsSearchingSeer,
    pageFilters.selection,
    memberProjects,
    organization,
    navigate,
  ]);

  // Combine all dynamic actions (excluding recent issues for now)
  const dynamicActions = useMemo(
    () => [
      ...routeActions,
      ...orgActions,
      ...commandActions,
      ...formActions,
      ...apiActions,
    ],
    [apiActions, formActions, routeActions, orgActions, commandActions]
  );

  const [filteredAvailableActions, setFilteredAvailableActions] = useState<OmniAction[]>(
    []
  );
  const [filteredRecentIssues, setFilteredRecentIssues] = useState<OmniAction[]>([]);

  // Fuzzy search for general actions (including children)
  useEffect(() => {
    // If an action is selected, only search within its children
    if (selectedAction?.children?.length) {
      if (debouncedQuery) {
        createFuzzySearch(selectedAction.children, {
          keys: ['label', 'fullLabel', 'details'],
          getFn: strGetFn,
          shouldSort: false,
          minMatchCharLength: 1,
        }).then(f => {
          setFilteredAvailableActions(f.search(debouncedQuery).map(r => r.item));
        });
      } else {
        setFilteredAvailableActions(selectedAction.children);
      }
      return;
    }

    // Flatten all actions to include their children in search
    const allActions = [
      ...flattenActions(availableActions),
      ...flattenActions(dynamicActions),
    ];

    createFuzzySearch(allActions, {
      keys: ['label', 'fullLabel', 'details'],
      getFn: strGetFn,
      shouldSort: false,
      minMatchCharLength: 1,
    }).then(f => {
      setFilteredAvailableActions(f.search(debouncedQuery).map(r => r.item));
    });
  }, [availableActions, debouncedQuery, dynamicActions, selectedAction]);

  // Fuzzy search for recent issues separately to control the limit
  useEffect(() => {
    setSeerError(false);

    // Don't show recent issues when an action or area is selected
    if (selectedAction?.children?.length || focusedArea) {
      setFilteredRecentIssues([]);
      return;
    }

    if (debouncedQuery) {
      createFuzzySearch(allRecentIssueActions, {
        keys: ['label'],
        getFn: strGetFn,
        shouldSort: false,
      }).then(f => {
        // Fuzzy search ALL recent issues, then limit to max 5
        const searchResults = f.search(debouncedQuery).map(r => r.item);
        setFilteredRecentIssues(searchResults.slice(0, 5));
      });
    } else {
      // When no query, show first 5 recent issues
      setFilteredRecentIssues(allRecentIssueActions.slice(0, 5));
    }
  }, [allRecentIssueActions, debouncedQuery, selectedAction, focusedArea]);

  const grouped = useMemo(() => {
    // If an action is selected, only show its children
    if (selectedAction?.children?.length) {
      const actions = debouncedQuery ? filteredAvailableActions : selectedAction.children;

      // Group by section label
      const bySection = new Map<string, OmniAction[]>();
      for (const action of actions) {
        const sectionLabel = action.section ?? '';
        const list = bySection.get(sectionLabel) ?? [];
        list.push(action);
        bySection.set(sectionLabel, list);
      }

      const sectionKeys = Array.from(bySection.keys());
      return sectionKeys.map(sectionKey => {
        const label = sectionKey;
        const items = bySection.get(sectionKey) ?? [];
        return {sectionKey, label, items};
      });
    }

    // Filter actions based on query
    let actions = debouncedQuery
      ? [...filteredAvailableActions, ...filteredRecentIssues]
      : [...filteredRecentIssues, ...availableActions];

    // Add Ask Seer action at the top if there's a query
    if (debouncedQuery) {
      actions = [askSeerAction, ...actions];
    }

    // Group by section label
    const bySection = new Map<string, OmniAction[]>();
    for (const action of actions) {
      const sectionLabel = action.section ?? '';
      const list = bySection.get(sectionLabel) ?? [];
      list.push(action);
      bySection.set(sectionLabel, list);
    }

    const sectionKeys = Array.from(bySection.keys());

    return sectionKeys.map(sectionKey => {
      const label = sectionKey;
      const items = bySection.get(sectionKey) ?? [];
      return {sectionKey, label, items};
    });
  }, [
    availableActions,
    debouncedQuery,
    filteredAvailableActions,
    filteredRecentIssues,
    selectedAction,
    askSeerAction,
  ]);

  // Get the first item's key to set as the default selected value
  const firstItemKey = useMemo(() => {
    const firstItem = grouped.find(group => group.items.length > 0)?.items[0];
    return firstItem?.key || '';
  }, [grouped]);

  const handleSelect = (action: OmniAction) => {
    resetInactivityTimer();
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
      navigate(normalizeUrl(action.to));
    }

    // TODO: Any other action handlers?

    if (!action.keepOpen) {
      closeModal();
    }
  };

  // When an action has been selected, clear the query and focus the input
  useLayoutEffect(() => {
    if (selectedAction) {
      setQuery('');
      inputRef.current?.focus();
      setFilteredAvailableActions(selectedAction.children ?? []);
    }
  }, [selectedAction]);

  const placeholder = useMemo(() => {
    if (selectedAction) {
      return selectedAction.label;
    }
    return 'Type for actions…';
  }, [selectedAction]);

  const triggerSeeryImpatient = () => {
    seeryRef.current?.triggerImpatient();
  };

  const triggerSeeryError = () => {
    seeryRef.current?.triggerError();
  };

  const triggerSeeryCelebrate = () => {
    seeryRef.current?.triggerCelebrate();
  };

  const triggerSeeryWatching = () => {
    seeryRef.current?.triggerWatching();
  };

  const triggerSeerySearchDone = () => {
    seeryRef.current?.triggerSearchDone();
  };

  const triggerSeeryBarrelRoll = () => {
    seeryRef.current?.triggerBarrelRoll();
  };

  useImperativeHandle(
    ref,
    () => ({
      triggerSeeryBarrelRoll,
      triggerSeeryImpatient,
      triggerSeeryError,
      triggerSeeryCelebrate,
      triggerSeeryWatching,
      triggerSeerySearchDone,
    }),
    []
  );

  // Call triggerSeeryError if results are empty, but avoid repeated calls for the same state
  const lastResultWasEmpty = useRef<boolean | null>(null);
  useEffect(() => {
    const handler = setTimeout(() => {
      const isEmpty = query.length > 0 && grouped.every(g => g.items.length === 0);

      if (isEmpty !== lastResultWasEmpty.current) {
        if (isEmpty) {
          triggerSeeryError();
        } else if (query.length > 0) {
          triggerSeerySearchDone();
        }
        lastResultWasEmpty.current = isEmpty;
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(handler);
  }, [grouped, query]);

  // Watch for user typing and trigger watching state
  const lastQueryRef = useRef<string>('');
  useEffect(() => {
    // Only trigger when user starts typing (from empty to non-empty)
    if (lastQueryRef.current.length === 0 && query.length > 0) {
      triggerSeeryWatching();
    }
    lastQueryRef.current = query;
  }, [query]);

  // Inactivity timer for impatient animation
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityTimeRef = useRef<number>(Date.now());

  const resetInactivityTimer = useCallback(() => {
    lastActivityTimeRef.current = Date.now();
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }
    inactivityTimerRef.current = setTimeout(() => {
      triggerSeeryImpatient();
    }, 5000);
  }, []);

  // Reset timer on any user interaction
  useEffect(() => {
    resetInactivityTimer();
  }, [resetInactivityTimer]); // Empty dependency array - only run once on mount

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, []);

  return (
    <Fragment>
      <SeeryCharacter ref={seeryRef} animationData={serryLottieAnimation} size={400} />
      <SeerSearchAnimation />
      <StyledCommand key={firstItemKey} label="OmniSearch" shouldFilter={false} loop>
        <Header>
          {focusedArea && (
            <FocusedAreaContainer>
              <FocusedArea>{focusedArea.label}</FocusedArea>
            </FocusedAreaContainer>
          )}
          <SearchInputContainer>
            {selectedAction && (
              <BackButton
                onClick={() => {
                  resetInactivityTimer();
                  clearSelection();
                }}
              >
                <IconArrow direction="left" size="sm" />
              </BackButton>
            )}
            <SearchInput
              autoFocus
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              onKeyDown={e => {
                resetInactivityTimer();
                if (e.key === 'Backspace' && query === '') {
                  clearSelection();
                  e.preventDefault();
                  triggerSeeryImpatient();
                  setSeerIsExiting(false);
                }
              }}
              placeholder={placeholder}
              disabled={isSearchingSeer || seerIsExiting}
            />
          </SearchInputContainer>
        </Header>
        {isSearchingSeer || seerIsExiting ? (
          <SeerLoadingContainer>
            <BrainHead src={brainhead} alt="Loading..." />
            <LoadingCaption>MAKING IT MAKE SENSE</LoadingCaption>
          </SeerLoadingContainer>
        ) : (
          <CommandPrimitive.Command.List>
            {grouped.every(g => g.items.length === 0) || seerError ? (
              <CommandPrimitive.Command.Empty>
                <img src={error} alt="No results" />
                <p>Whoops… we couldn't find any results matching your search.</p>
                <p>Try rephrasing your query maybe?</p>
              </CommandPrimitive.Command.Empty>
            ) : (
              grouped.map(group => (
                <Fragment key={group.sectionKey}>
                  {group.items.length > 0 && (
                    <CommandPrimitive.Command.Group heading={group.label}>
                      {group.items.map(item => (
                        <CommandPrimitive.Command.Item
                          key={item.key}
                          value={item.key}
                          onSelect={() => handleSelect(item)}
                          disabled={item.disabled}
                        >
                          <ItemRow>
                            {item.actionIcon && (
                              <IconDefaultsProvider size="sm">
                                <IconWrapper>{item.actionIcon}</IconWrapper>
                              </IconDefaultsProvider>
                            )}
                            <OverflowHidden>
                              <div>
                                {item.label}
                                {item.children && item.children.length > 0 && '…'}
                              </div>
                              {item.details && <ItemDetails>{item.details}</ItemDetails>}
                            </OverflowHidden>
                          </ItemRow>
                        </CommandPrimitive.Command.Item>
                      ))}
                    </CommandPrimitive.Command.Group>
                  )}
                </Fragment>
              ))
            )}
          </CommandPrimitive.Command.List>
        )}
      </StyledCommand>
    </Fragment>
  );
}

const Header = styled('div')`
  position: relative;

  [data-matrix-mode='true'] & {
    background-color: #101e13;
    color: #00ff00;
  }
`;

const SearchInputContainer = styled('div')`
  position: relative;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 4px 16px;
  border-bottom: 1px solid ${p => p.theme.border};

  [data-matrix-mode='true'] & {
    padding: 2px 10px;
    gap: 4px;
    border: 2px solid #1a5200;
  }
`;

const BackButton = styled('button')`
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  border-radius: 4px;
  color: ${p => p.theme.subText};
  transition: all 0.1s ease-out;

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
    color: ${p => p.theme.textColor};
  }

  [data-matrix-mode='true'] & {
    color: #00ff00;
    transition: all 0.2s ease;
    padding: 4px;
    border-radius: 0;

    &:hover {
      background-color: rgba(0, 255, 0, 0.1);
      color: #00ff00;
    }
  }
`;

const SearchInput = styled(CommandPrimitive.Command.Input)`
  position: relative;
  background-color: ${p => p.theme.background};
  width: 100%;
  outline: none;
  border: none;
  font-size: ${p => p.theme.fontSize.lg};
  line-height: 1;
  height: 40px;

  &:disabled {
    opacity: 0.5;
  }

  [data-matrix-mode='true'] & {
    background-color: #101e13;
    color: #00ff00;
    font-family: 'Departure Mono', monospace;
    text-transform: uppercase;
    height: 40px;
    font-size: 14px;

    &::placeholder {
      color: rgba(0, 255, 0, 0.6);
    }

    &:focus {
      border-color: #00ff00;
    }
  }
`;

const FocusedAreaContainer = styled('div')`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
  padding-bottom: 0;

  [data-matrix-mode='true'] & {
    padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  }
`;

const FocusedArea = styled(Tag)`
  font-size: ${p => p.theme.fontSize.xs};
  color: ${p => p.theme.subText};
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  text-transform: uppercase;
  font-weight: ${p => p.theme.fontWeight.bold};
  border: 1px solid ${p => p.theme.border};
  width: fit-content;
  border-radius: ${p => p.theme.borderRadius};

  [data-matrix-mode='true'] & {
    background-color: #101e13;
    color: #00ff00;
    border-color: #00ff00;
    font-family: 'Departure Mono', monospace;
    text-transform: uppercase;

    font-size: 10px;
    padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  }
`;

const IconWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  height: 18px;
  width: 18px;

  opacity: 0.75;
  transition: all 0.1s ease-out;

  [data-matrix-mode='true'] & {
    opacity: 0.5;
  }
`;

const StyledCommand = styled(CommandPrimitive.Command)`
  &[cmdk-root] {
    width: 100%;
    background: ${p => p.theme.background};
    border-radius: 6px;
    overflow: hidden;

    [data-matrix-mode='true'] & {
      background: #101e13;
      border-radius: 0;
      font-family: 'Departure Mono', monospace;
      text-transform: uppercase;

      &:before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: calc(100% + 12px);
        height: calc(100% + 12px);
        background: #101e13;
      }
    }
  }

  [cmdk-list] {
    position: relative;
    padding: 6px;
    height: 500px;
    overflow-y: auto;
    overscroll-behavior: contain;
    scroll-padding-block-start: 64px;
    scroll-padding-block-end: 64px;

    &:focus {
      outline: none;
    }

    background:
      /* Shadow covers */
      linear-gradient(${p => p.theme.background} 30%, rgba(255, 255, 255, 0)),
      linear-gradient(rgba(255, 255, 255, 0), ${p => p.theme.background} 70%) 0 100%,
      /* Shadows */ linear-gradient(to bottom, rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0)),
      linear-gradient(to top, rgba(0, 0, 0, 0.05), rgba(0, 0, 0, 0)) 0 100%;

    background-repeat: no-repeat;
    background-size:
      100% 40px,
      100% 40px,
      100% 20px,
      100% 20px;

    background-attachment: local, local, scroll, scroll;

    [data-matrix-mode='true'] & {
      background: #101e13;
      color: #00ff00;
      font-family: 'Departure Mono', monospace;
      text-transform: uppercase;
      padding: 6px;
      height: 500px;

      /* Custom scrollbar styling */
      &::-webkit-scrollbar {
        width: 8px;
      }

      &::-webkit-scrollbar-track {
        background: #0a150d;
        border: 1px solid #1a5200;
      }

      &::-webkit-scrollbar-thumb {
        background: #00ff00;
        border: 1px solid #1a5200;
      }

      &::-webkit-scrollbar-thumb:hover {
        background: #00cc00;
      }

      &::-webkit-scrollbar-corner {
        background: #0a150d;
        border: 1px solid #1a5200;
      }

      /* Firefox scrollbar */
      scrollbar-width: thin;
      scrollbar-color: #00ff00 #0a150d;
    }
  }

  [cmdk-group] {
    margin-top: 8px;

    + * {
      [cmdk-group-heading] {
        padding-top: 12px;
        border-top: 1px solid ${p => p.theme.border};
      }
    }

    [data-matrix-mode='true'] & {
      margin-top: 2px;

      + * {
        [cmdk-group-heading] {
          padding-top: 12px;
          border-top: 1px solid #1a5200;
        }
      }
    }
  }

  [cmdk-group-heading] {
    text-transform: uppercase;
    font-size: ${p => p.theme.fontSize.xs};
    letter-spacing: 0.02em;
    font-weight: 600;
    color: ${p => p.theme.subText};
    padding-bottom: 4px;
    margin: 0 12px;

    [data-matrix-mode='true'] & {
      color: #00ff00;
      font-family: 'Departure Mono', monospace;
      font-weight: bold;
      font-size: 10px;
      padding-bottom: 4px;
      margin: 0 6px;
    }
  }

  [cmdk-item] {
    text-transform: none;
    padding: 12px;
    font-size: ${p => p.theme.fontSize.md};
    color: ${p => p.theme.textColor};
    cursor: pointer;
    border-radius: 4px;
    position: relative;

    &[data-selected='true'] {
      background-color: ${p => p.theme.backgroundSecondary};
      color: ${p => p.theme.purple400};

      ${IconWrapper} {
        opacity: 1;
        transform: scale(1.1);
      }
    }

    [data-matrix-mode='true'] & {
      color: #00ff00;
      font-family: 'Departure Mono', monospace;
      text-transform: uppercase;
      border: 1px solid transparent;
      padding: 6px 10px;
      font-size: 12px;
      border-radius: 0;
      margin: 0 -6px;

      ${IconWrapper} {
        transition: none;
      }

      &[data-selected='true'] {
        background-color: #00ff00;
        color: black;
        border-color: #00ff00;

        ${IconWrapper} {
          opacity: 1;
          transform: scale(1);
        }
      }
    }
  }

  [cmdk-empty] {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    font-size: ${p => p.theme.fontSize.md};
    color: ${p => p.theme.subText};
    text-align: center;
    padding: 24px 12px;
    height: 400px;

    img {
      width: 100%;
      max-width: 400px;
      margin-bottom: 12px;
    }

    p {
      margin: 0;
    }

    [data-matrix-mode='true'] & {
      color: #00ff00;
      font-family: 'Departure Mono', monospace;
      text-transform: uppercase;

      img {
        filter: hue-rotate(120deg) brightness(1.5) contrast(1.2);
      }
    }
  }
`;

const ItemRow = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 8px;
  align-items: start;
  justify-content: start;
  overflow: hidden;
`;

const ItemDetails = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  ${p => p.theme.overflowEllipsis}

  [data-matrix-mode='true'] & {
    color: #00ff00;
    opacity: 0.75;
  }

  [data-selected='true'] & {
    [data-matrix-mode='true'] & {
      color: black;
    }
  }
`;

const OverflowHidden = styled('div')`
  overflow: hidden;
`;

const SeerLoadingContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: 60px 20px;
  min-height: 300px;
`;

const BrainHead = styled('img')`
  width: 180px;
  height: 180px;
  animation: pulse 1.5s ease-in-out infinite;
  margin-bottom: 24px;

  @keyframes pulse {
    0% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
    100% {
      opacity: 0.6;
    }
  }
`;

const LoadingCaption = styled('div')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: 600;
  color: ${p => p.theme.textColor};
  letter-spacing: 0.5px;
`;
