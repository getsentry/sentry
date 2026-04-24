import {Fragment} from 'react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
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
import {IconBookmark, IconFilter, IconIssues, IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Tag} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {FieldKey} from 'sentry/utils/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useUser} from 'sentry/utils/useUser';
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

// Issue property fields to expose as filter actions, in display order.
const FILTER_KEY_ORDER: FieldKey[] = [
  FieldKey.IS,
  FieldKey.ISSUE_PRIORITY,
  FieldKey.ISSUE_CATEGORY,
  FieldKey.ASSIGNED,
  FieldKey.ISSUE_SEER_ACTIONABILITY,
  FieldKey.ISSUE_TYPE,
];

const FILTER_LABEL: Partial<Record<FieldKey, string>> = {
  [FieldKey.IS]: t('Status'),
  [FieldKey.ISSUE_PRIORITY]: t('Priority'),
  [FieldKey.ISSUE_CATEGORY]: t('Category'),
  [FieldKey.ASSIGNED]: t('Assigned To'),
  [FieldKey.ISSUE_SEER_ACTIONABILITY]: t('Fixability'),
  [FieldKey.ISSUE_TYPE]: t('Issue Type'),
};

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
  const filterKeys = useIssueListFilterKeys();

  return (
    <CMDKAction
      display={{label: t('Filter by'), icon: <IconFilter />}}
      keywords={['search', 'filter', 'narrow', 'where', 'show']}
    >
      {FILTER_KEY_ORDER.map(key => {
        const tag = filterKeys[key];
        if (!tag) return null;

        const label = FILTER_LABEL[key] ?? tag.name;

        return (
          <CMDKAction
            key={key}
            display={{label}}
            keywords={[key]}
            prompt={t('Select a value...')}
            resource={(
              _cmdkQuery: string,
              {state}: CMDKResourceContext
            ): CMDKQueryOptions =>
              // Include the feed query in the cache key so the onAction closures
              // are always built against the current query when it changes.
              // eslint-disable-next-line @tanstack/query/exhaustive-deps
              cmdkQueryOptions({
                queryKey: ['issue-filter-values', key, query],
                queryFn: () =>
                  getTagValueStrings(tag).map(value => ({
                    display: {label: value},
                    onAction: () => onQueryChange(appendFilterToken(query, key, value)),
                  })),
                enabled: state === 'selected',
                staleTime: Infinity,
              })
            }
          />
        );
      })}
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
