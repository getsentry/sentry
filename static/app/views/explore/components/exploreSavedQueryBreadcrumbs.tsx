import {Fragment} from 'react';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';
import {Button} from '@sentry/scraps/button';
import type {MenuItemProps} from '@sentry/scraps/dropdownMenu';
import type {LinkProps} from '@sentry/scraps/link';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openSaveQueryModal} from 'sentry/actionCreators/modal';
import {IconCopy, IconDelete, IconEllipsis, IconInput, IconStar} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {unreachable} from 'sentry/utils/unreachable';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  CONVERSATIONS_SIDEBAR_LABEL,
  EXPLORE_AGENTS_SUB_PATH,
} from 'sentry/views/explore/conversations/settings';
import {useDeleteQuery} from 'sentry/views/explore/hooks/useDeleteQuery';
import {
  getSavedQueryTraceItemDataset,
  useGetSavedQuery,
  useInvalidateSavedQuery,
  type SavedQuery,
} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {useFromSavedQuery} from 'sentry/views/explore/hooks/useSaveQuery';
import {useStarSavedQuery} from 'sentry/views/explore/hooks/useStarSavedQuery';
import {makeLogsPathname} from 'sentry/views/explore/logs/utils';
import {makeMetricsPathname} from 'sentry/views/explore/metrics/utils';
import {makeReplaysPathname} from 'sentry/views/explore/replays/pathnames';
import {confirmDeleteSavedQuery} from 'sentry/views/explore/utils';
import {TopBar} from 'sentry/views/navigation/topBar';
import {makeTracesPathname} from 'sentry/views/traces/pathnames';

/**
 * Which Explore surface a saved query belongs to.
 *
 * Deliberately not `TraceItemDataset`: that enum has no conversations member,
 * and `ai_conversations` saved queries map onto `TraceItemDataset.SPANS`, so
 * Agents and Traces are indistinguishable by dataset. The surface is a property
 * of the route, which the caller already knows.
 */
export type ExploreSurface =
  | 'traces'
  | 'compare'
  | 'logs'
  | 'metrics'
  | 'replays'
  | 'agents';

type BreadcrumbItems = React.ComponentProps<typeof BreadcrumbList>['items'];

interface SurfaceConfig {
  /**
   * Which analytics family this surface reports under, or `null` where no
   * events are registered. Keyed on the surface rather than the saved query's
   * dataset: `ai_conversations` resolves to `SPANS`, so a dataset-keyed check
   * would file every Agents action under Trace Explorer.
   */
  analytics: 'trace_explorer' | 'logs' | 'conversations' | null;
  /** Parent crumbs, in order. Never includes the page itself. */
  items: BreadcrumbItems;
  /** Where the page returns to once its query is deleted. */
  landingTo: LinkProps['to'];
  saveQueryModalSource: 'explorer' | 'conversations';
}

function useSurfaceConfig(surface: ExploreSurface): SurfaceConfig {
  const organization = useOrganization();

  switch (surface) {
    case 'traces': {
      const to = makeTracesPathname({organization, path: '/'});
      return {
        analytics: 'trace_explorer',
        items: [{type: 'link', label: t('Traces'), to}],
        landingTo: to,
        saveQueryModalSource: 'explorer',
      };
    }
    case 'compare': {
      // Compare mode lives under Traces but has its own landing page, so it
      // stays in the trail as a real parent rather than being dropped.
      const comparePath = makeTracesPathname({organization, path: '/compare/'});
      return {
        analytics: 'trace_explorer',
        items: [
          {
            type: 'link',
            label: t('Traces'),
            to: makeTracesPathname({organization, path: '/'}),
          },
          {type: 'link', label: t('Compare Queries'), to: comparePath},
        ],
        landingTo: comparePath,
        saveQueryModalSource: 'explorer',
      };
    }
    case 'logs': {
      const to = makeLogsPathname({organizationSlug: organization.slug, path: '/'});
      return {
        analytics: 'logs',
        items: [{type: 'link', label: t('Logs'), to}],
        landingTo: to,
        saveQueryModalSource: 'explorer',
      };
    }
    case 'metrics': {
      const to = makeMetricsPathname({organizationSlug: organization.slug, path: '/'});
      return {
        analytics: null,
        items: [{type: 'link', label: t('Application Metrics'), to}],
        landingTo: to,
        saveQueryModalSource: 'explorer',
      };
    }
    case 'replays': {
      const to = makeReplaysPathname({organization, path: '/'});
      return {
        analytics: null,
        items: [{type: 'link', label: t('Replays'), to}],
        landingTo: to,
        saveQueryModalSource: 'explorer',
      };
    }
    case 'agents': {
      const pathname = normalizeUrl(
        `/organizations/${organization.slug}/explore/${EXPLORE_AGENTS_SUB_PATH}/`
      );
      return {
        analytics: 'conversations',
        // Agents caps its pickable range and its landing page defaults to 24h.
        items: [
          {
            type: 'link',
            label: CONVERSATIONS_SIDEBAR_LABEL,
            to: {pathname, query: {statsPeriod: '24h'}},
          },
        ],
        landingTo: pathname,
        saveQueryModalSource: 'conversations',
      };
    }
    default:
      unreachable(surface);
      return {
        analytics: null,
        items: [],
        landingTo: '',
        saveQueryModalSource: 'explorer',
      };
  }
}

function useSavedQueryMenuItems({
  savedQuery,
  savedQueryId,
  config,
}: {
  config: SurfaceConfig;
  savedQuery: SavedQuery;
  savedQueryId: string;
}): MenuItemProps[] {
  const organization = useOrganization();
  const navigate = useNavigate();
  const {deleteQuery} = useDeleteQuery();
  const {saveQueryFromSavedQuery, updateQueryFromSavedQuery} = useFromSavedQuery();
  const invalidateSavedQuery = useInvalidateSavedQuery(savedQueryId);

  const duplicate: MenuItemProps = {
    key: 'duplicate',
    label: t('Duplicate'),
    leadingItems: <IconCopy size="md" />,
    onAction: async () => {
      addLoadingMessage(t('Duplicating query...'));
      try {
        await saveQueryFromSavedQuery({
          ...savedQuery,
          name: `${savedQuery.name} (Copy)`,
        });
        addSuccessMessage(t('Query duplicated'));
      } catch (error) {
        addErrorMessage(t('Unable to duplicate query'));
      }
    },
  };

  // A Sentry-authored query cannot be renamed or deleted, matching how the
  // saved queries table treats them.
  if (savedQuery.isPrebuilt) {
    return [duplicate];
  }

  const rename: MenuItemProps = {
    key: 'rename',
    label: t('Rename'),
    leadingItems: <IconInput size="md" />,
    onAction: () => {
      if (config.analytics === 'trace_explorer') {
        trackAnalytics('trace_explorer.save_query_modal', {
          action: 'open',
          save_type: 'rename_query',
          ui_source: 'explorer',
          organization,
        });
      } else if (config.analytics === 'logs') {
        trackAnalytics('logs.save_query_modal', {
          action: 'open',
          save_type: 'rename_query',
          ui_source: 'explorer',
          organization,
        });
      } else if (config.analytics === 'conversations') {
        trackAnalytics('conversations.save_query_modal', {
          action: 'open',
          save_type: 'rename_query',
          organization,
        });
      }

      openSaveQueryModal({
        organization,
        name: savedQuery.name,
        source: config.saveQueryModalSource,
        traceItemDataset: getSavedQueryTraceItemDataset(savedQuery.dataset),
        saveQuery: async ({name}: {name: string}) => {
          const response = await updateQueryFromSavedQuery({...savedQuery, name});
          // `updateQueryFromSavedQuery` only invalidates the saved query *list*,
          // which is all the saved queries table needs. The page title reads the
          // individual query, so without this it keeps rendering the old name.
          invalidateSavedQuery();
          return response;
        },
      });
    },
  };

  const remove: MenuItemProps = {
    key: 'delete',
    label: t('Delete'),
    priority: 'danger',
    leadingItems: <IconDelete size="md" />,
    onAction: () => {
      confirmDeleteSavedQuery({
        handleDelete: async () => {
          addLoadingMessage(t('Deleting query...'));
          try {
            await deleteQuery(savedQuery.id);
            addSuccessMessage(t('Query deleted'));
          } catch (error) {
            addErrorMessage(t('Unable to delete query'));
            return;
          }

          if (config.analytics === 'trace_explorer') {
            trackAnalytics('trace_explorer.delete_query', {organization});
          } else if (config.analytics === 'logs') {
            trackAnalytics('logs.delete_query', {organization});
          }

          navigate(config.landingTo);
        },
        savedQuery,
      });
    },
  };

  return [rename, duplicate, remove];
}

function SavedQueryTitle({
  savedQuery,
  savedQueryId,
  config,
}: {
  config: SurfaceConfig;
  savedQuery: SavedQuery;
  savedQueryId: string;
}) {
  const items = useSavedQueryMenuItems({savedQuery, savedQueryId, config});
  const {isStarred, toggleStar} = useStarSavedQuery({
    savedQueryId,
    analytics: config.analytics,
  });

  const starLabel = isStarred ? t('Unstar') : t('Star');

  return (
    <BreadcrumbList.Title
      item={{
        type: 'page-title',
        label: savedQuery.name,
        trailingActions: [
          {
            type: 'menu',
            items,
            triggerLabel: t('More saved query options'),
            triggerIcon: <IconEllipsis />,
          },
          {
            type: 'button',
            element: (
              <Button
                size="zero"
                variant="transparent"
                aria-label={starLabel}
                tooltipProps={{title: starLabel}}
                icon={
                  <IconStar
                    isSolid={isStarred}
                    variant={isStarred ? 'warning' : 'muted'}
                  />
                }
                onClick={toggleStar}
              />
            ),
          },
        ],
      }}
    />
  );
}

interface ExploreSavedQueryBreadcrumbsProps {
  savedQueryId: string;
  surface: ExploreSurface;
  /**
   * The `title` URL param. Used as the label until the saved query resolves, so
   * the heading does not flash a placeholder on load.
   */
  title?: string;
}

/**
 * Header for an Explore saved query: the surface's landing page as a parent
 * crumb, and the query name as the page title with its own actions menu and
 * star toggle.
 */
export function ExploreSavedQueryBreadcrumbs({
  savedQueryId,
  surface,
  title,
}: ExploreSavedQueryBreadcrumbsProps) {
  const config = useSurfaceConfig(surface);
  const {data: savedQuery} = useGetSavedQuery(savedQueryId);

  return (
    <Fragment>
      <TopBar.Slot name="breadcrumbs">
        <BreadcrumbList items={config.items} />
      </TopBar.Slot>
      <TopBar.Slot name="title">
        {savedQuery ? (
          <SavedQueryTitle
            savedQuery={savedQuery}
            savedQueryId={savedQueryId}
            config={config}
          />
        ) : (
          <BreadcrumbList.Title
            item={{type: 'page-title', label: title ?? t('Saved Query')}}
          />
        )}
      </TopBar.Slot>
    </Fragment>
  );
}
