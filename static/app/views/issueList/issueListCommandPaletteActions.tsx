import {Fragment, useMemo} from 'react';
import orderBy from 'lodash/orderBy';

import {UserAvatar} from '@sentry/scraps/avatar';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {fetchFeatureFlagValues, fetchTagValues} from 'sentry/actionCreators/tags';
import {
  cmdkQueryOptions,
  type CMDKQueryOptions,
} from 'sentry/components/commandPalette/types';
import {
  CMDKAction,
  type CMDKResourceContext,
} from 'sentry/components/commandPalette/ui/cmdk';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import type {SearchGroup} from 'sentry/components/searchBar/types';
import {IconBookmark, IconFilter, IconGroup, IconIssues, IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Tag} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getUtcDateString} from 'sentry/utils/dates';
import {
  DEVICE_CLASS_TAG_VALUES,
  FieldKey,
  FieldKind,
  isDeviceClass,
} from 'sentry/utils/fields';
import {useApi} from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useUser} from 'sentry/utils/useUser';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {mergeAndSortTagValues} from 'sentry/views/issueDetails/utils';
import {createIssueViewFromUrl} from 'sentry/views/issueList/issueViews/createIssueViewFromUrl';
import {CreateIssueViewModal} from 'sentry/views/issueList/issueViews/createIssueViewModal';
import {useIssueViewUnsavedChanges} from 'sentry/views/issueList/issueViews/useIssueViewUnsavedChanges';
import {useSelectedGroupSearchView} from 'sentry/views/issueList/issueViews/useSelectedGroupSeachView';
import {canEditIssueView} from 'sentry/views/issueList/issueViews/utils';
import {useUpdateGroupSearchView} from 'sentry/views/issueList/mutations/useUpdateGroupSearchView';
import {
  FOR_REVIEW_QUERIES,
  getSortLabel,
  IssueSortOptions,
} from 'sentry/views/issueList/utils';
import {useIssueListFilterKeys} from 'sentry/views/issueList/utils/useIssueListFilterKeys';

interface IssueListCommandPaletteActionsProps {
  onQueryChange: (query: string) => void;
  onSortChange: (sort: string) => void;
  query: string;
  sort: IssueSortOptions;
}

/**
 * Extracts a flat list of string values from a tag's predefined values.
 * Handles both plain string arrays and SearchGroup arrays (with or without
 * child items under header groups).
 */
function getTagValueStrings(tag: Tag): string[] {
  if (!tag.values?.length) return [];
  if (typeof tag.values[0] === 'string') return tag.values as string[];

  const groups = tag.values as SearchGroup[];
  return groups.flatMap(group => {
    if (group.type === 'header') {
      return group.children.map(child => child.value ?? '').filter(v => v.length > 0);
    }
    return group.value ? [group.value] : [];
  });
}

function appendFilterToken(currentQuery: string, key: string, value: string): string {
  const token = value.includes(' ') ? `${key}:"${value}"` : `${key}:${value}`;
  return currentQuery.trim() ? `${currentQuery.trim()} ${token}` : token;
}

function FilterActions({
  query,
  onQueryChange,
}: Pick<IssueListCommandPaletteActionsProps, 'query' | 'onQueryChange'>) {
  const api = useApi();
  const organization = useOrganization();
  const user = useUser();
  const {selection: pageFilters} = usePageFilters();
  const filterKeys = useIssueListFilterKeys();

  // Stable string derived from page filters for use in query cache keys — ensures
  // API-fetched tag values are invalidated when the project or date selection changes.
  const pageFilterCacheKey = useMemo(
    () =>
      [
        pageFilters.projects.join(','),
        pageFilters.datetime.period ?? '',
        pageFilters.datetime.start?.toString() ?? '',
        pageFilters.datetime.end?.toString() ?? '',
      ].join('|'),
    [pageFilters]
  );

  // Fetches the top tag values from the events/issue-platform datasets.
  // Mirrors tagValueLoader in searchBar.tsx, but always searches with an empty
  // string so the cmdk shows the most common values rather than filtered results.
  const loadTagValues = async (key: string): Promise<string[]> => {
    if (isDeviceClass(key)) {
      return DEVICE_CLASS_TAG_VALUES;
    }

    const projectIds = pageFilters.projects.map(id => id.toString());
    const endpointParams = {
      start: pageFilters.datetime.start
        ? getUtcDateString(pageFilters.datetime.start)
        : undefined,
      end: pageFilters.datetime.end
        ? getUtcDateString(pageFilters.datetime.end)
        : undefined,
      statsPeriod: pageFilters.datetime.period,
    };
    const fetchParams = {
      api,
      orgSlug: organization.slug,
      tagKey: key,
      search: '',
      projectIds,
      endpointParams,
      sort: '-count' as const,
    };

    if (filterKeys[key]?.kind === FieldKind.FEATURE_FLAG) {
      const values = await fetchFeatureFlagValues({...fetchParams, organization});
      return values.map(v => v.value);
    }

    if (key === FieldKey.FIRST_RELEASE) {
      const values = await fetchTagValues({
        ...fetchParams,
        tagKey: 'release',
        dataset: Dataset.ERRORS,
      });
      return ['latest', ...values.map(v => v.value)];
    }

    const [errorsValues, platformValues] = await Promise.all([
      fetchTagValues({...fetchParams, dataset: Dataset.ERRORS}),
      fetchTagValues({...fetchParams, dataset: Dataset.ISSUE_PLATFORM}),
    ]);

    return mergeAndSortTagValues(errorsValues, platformValues, 'count').map(v => v.value);
  };

  const issueFields = useMemo(
    () =>
      orderBy(
        Object.values(filterKeys).filter(tag => tag.kind === FieldKind.ISSUE_FIELD),
        ['key']
      ),
    [filterKeys]
  );

  const eventFields = useMemo(
    () =>
      orderBy(
        Object.values(filterKeys).filter(tag => tag.kind === FieldKind.EVENT_FIELD),
        ['key']
      ),
    [filterKeys]
  );

  const eventTags = useMemo(
    () =>
      orderBy(
        Object.values(filterKeys).filter(tag => tag.kind === FieldKind.TAG),
        ['totalValues', 'key'],
        ['desc', 'asc']
      ),
    [filterKeys]
  );

  const makeFilterKeyItem = (tag: Tag) => {
    const predefined = getTagValueStrings(tag);
    const hasPredefined = predefined.length > 0;
    return {
      display: {label: `${tag.name.charAt(0).toUpperCase()}${tag.name.slice(1)}`},
      keywords: [tag.key],
      prompt: t('Select a value...'),
      limit: 4,
      resource: (_q: string, ctx: CMDKResourceContext): CMDKQueryOptions =>
        // eslint-disable-next-line @tanstack/query/exhaustive-deps
        cmdkQueryOptions({
          queryKey: ['cmdk-filter-values', tag.key, query, pageFilterCacheKey],
          queryFn: async () => {
            const values = hasPredefined ? predefined : await loadTagValues(tag.key);
            return values.map(value => ({
              display: {
                label: value,
                icon:
                  tag.key === FieldKey.ASSIGNED && value === 'me' ? (
                    <UserAvatar user={user} size={16} hasTooltip={false} />
                  ) : undefined,
              },
              onAction: () => onQueryChange(appendFilterToken(query, tag.key, value)),
            }));
          },
          enabled: hasPredefined || ctx.state === 'selected',
          staleTime: hasPredefined ? Infinity : 30_000,
        }),
    };
  };

  const makeSectionResource =
    (
      tags: Tag[],
      cacheKey: string
    ): ((q: string, ctx: CMDKResourceContext) => CMDKQueryOptions) =>
    (_q, ctx) =>
      // Feed query in key ensures onAction closures reference the current query.
      // eslint-disable-next-line @tanstack/query/exhaustive-deps
      cmdkQueryOptions({
        queryKey: [cacheKey, organization.slug, pageFilterCacheKey, query],
        queryFn: () => tags.map(makeFilterKeyItem),
        enabled: ctx.state === 'selected',
        staleTime: Infinity,
      });

  return (
    <CMDKAction
      display={{label: t('Filter by'), icon: <IconFilter />}}
      keywords={['search', 'filter', 'narrow', 'where', 'show']}
    >
      <CMDKAction
        display={{
          label: t('Assigned to me'),
          icon: <UserAvatar user={user} size={16} hasTooltip={false} />,
        }}
        keywords={['mine', 'my issues', 'assign', 'assigned', 'me']}
        onAction={() => onQueryChange(appendFilterToken(query, 'assigned', 'me'))}
      />
      <CMDKAction
        display={{label: t('Assigned to my teams'), icon: <IconGroup />}}
        keywords={['my teams', 'assign', 'assigned', 'teams']}
        onAction={() => onQueryChange(appendFilterToken(query, 'assigned', 'my_teams'))}
      />
      <CMDKAction
        display={{label: t('Issues')}}
        prompt={t('Select a filter...')}
        limit={4}
        resource={makeSectionResource(issueFields, 'cmdk-filter-keys-issues')}
      />
      {eventFields.length > 0 && (
        <CMDKAction
          display={{label: t('Event Filters')}}
          prompt={t('Select a filter...')}
          limit={4}
          resource={makeSectionResource(eventFields, 'cmdk-filter-keys-events')}
        />
      )}
      {eventTags.length > 0 && (
        <CMDKAction
          display={{label: t('Event Tags')}}
          prompt={t('Select a filter...')}
          limit={4}
          resource={makeSectionResource(eventTags, 'cmdk-filter-keys-tags')}
        />
      )}
    </CMDKAction>
  );
}

function SortActions({
  sort,
  query,
  onSortChange,
}: Pick<IssueListCommandPaletteActionsProps, 'sort' | 'query' | 'onSortChange'>) {
  const sortKeys = [
    ...(FOR_REVIEW_QUERIES.includes(query) ? [IssueSortOptions.INBOX] : []),
    IssueSortOptions.DATE,
    IssueSortOptions.NEW,
    IssueSortOptions.TRENDS,
    IssueSortOptions.FREQ,
    IssueSortOptions.USER,
  ];

  return (
    <CMDKAction
      display={{
        label: t('Sort by: %s', getSortLabel(sort)),
        icon: <IconSort />,
      }}
      keywords={['order', 'arrange', 'last seen', 'age', 'events', 'users', 'trends']}
    >
      {sortKeys.map(key => (
        <CMDKAction
          key={key}
          display={{label: getSortLabel(key)}}
          onAction={() => onSortChange(key)}
        />
      ))}
    </CMDKAction>
  );
}

function SaveViewActions({
  query,
  sort,
}: Pick<IssueListCommandPaletteActionsProps, 'query' | 'sort'>) {
  const organization = useOrganization();
  const user = useUser();
  const {viewId} = useParams();
  const {selection} = usePageFilters();
  const location = useLocation();
  const {data: view} = useSelectedGroupSearchView();
  const {mutate: updateGroupSearchView} = useUpdateGroupSearchView();
  const {hasUnsavedChanges} = useIssueViewUnsavedChanges();

  if (!organization.features.includes('issue-views')) {
    return null;
  }

  const canEdit = view
    ? canEditIssueView({user, groupSearchView: view, organization})
    : false;

  const openSaveAsModal = () => {
    trackAnalytics('issue_views.save_as.clicked', {organization, source: 'cmdk'});
    openModal(props => (
      <CreateIssueViewModal
        {...props}
        analyticsSurface={viewId ? 'issue-view-details' : 'issues-feed'}
        name={view ? `${view.name} (Copy)` : undefined}
        query={query}
        querySort={sort}
        projects={selection.projects}
        environments={selection.environments}
        timeFilters={selection.datetime}
      />
    ));
  };

  const saveView = () => {
    if (view) {
      trackAnalytics('issue_views.save.clicked', {organization, source: 'cmdk'});
      updateGroupSearchView(
        {
          id: view.id,
          name: view.name,
          ...createIssueViewFromUrl({query: location.query}),
        },
        {
          onSuccess: () => {
            addSuccessMessage(t('Saved changes'));
          },
        }
      );
    }
  };

  return (
    <Fragment>
      {canEdit && hasUnsavedChanges && (
        <CMDKAction
          display={{label: t('Save view'), icon: <IconBookmark />}}
          keywords={['save', 'update', 'persist']}
          onAction={saveView}
        />
      )}
      <CMDKAction
        display={{label: t('Save as new view'), icon: <IconBookmark />}}
        keywords={['save as', 'new view', 'create view', 'bookmark']}
        onAction={openSaveAsModal}
      />
    </Fragment>
  );
}

export function IssueListCommandPaletteActions({
  query,
  sort,
  onSortChange,
  onQueryChange,
}: IssueListCommandPaletteActionsProps) {
  return (
    <CommandPaletteSlot name="page">
      <CMDKAction display={{label: t('Issues Feed'), icon: <IconIssues />}}>
        <FilterActions query={query} onQueryChange={onQueryChange} />
        <SortActions sort={sort} query={query} onSortChange={onSortChange} />
        <SaveViewActions query={query} sort={sort} />
      </CMDKAction>
    </CommandPaletteSlot>
  );
}
