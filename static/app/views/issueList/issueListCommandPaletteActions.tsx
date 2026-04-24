import {Fragment} from 'react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {IconBookmark, IconIssues, IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
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

interface IssueListCommandPaletteActionsProps {
  onSortChange: (sort: string) => void;
  query: string;
  sort: IssueSortOptions;
}

function SortActions({sort, query, onSortChange}: IssueListCommandPaletteActionsProps) {
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
}: IssueListCommandPaletteActionsProps) {
  return (
    <CommandPaletteSlot name="page">
      <CMDKAction display={{label: t('Issues Feed'), icon: <IconIssues />}}>
        <SortActions sort={sort} query={query} onSortChange={onSortChange} />
        <SaveViewActions query={query} sort={sort} />
      </CMDKAction>
    </CommandPaletteSlot>
  );
}
