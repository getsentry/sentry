import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useUpdateGroupSearchView} from 'sentry/views/issueList/mutations/useUpdateGroupSearchView';
import type {GroupSearchView} from 'sentry/views/issueList/types';
import {TopBar} from 'sentry/views/navigation/topBar';

export function EditableIssueViewHeader({view}: {view: GroupSearchView}) {
  // TODO(msun): Add tests for this component
  const organization = useOrganization();

  const user = useUser();

  const {mutate: updateGroupSearchView} = useUpdateGroupSearchView();

  const handleOnSave = (title: string) => {
    if (title !== view.name) {
      updateGroupSearchView(
        {
          name: title,
          id: view.id,
          projects: view.projects,
          query: view.query,
          querySort: view.querySort,
          timeFilters: view.timeFilters,
          environments: view.environments,
          optimistic: true,
        },
        {
          onSuccess: () => {
            trackAnalytics('issue_views.edit_name', {
              organization,
              ownership: user?.id === view.createdBy?.id ? 'personal' : 'organization',
              surface: 'issue-view-details',
            });
          },
        }
      );
    }
  };

  return (
    <TopBar.Slot
      name="breadcrumbs"
      title={{
        type: 'editable-title',
        value: view.name,
        onChange: handleOnSave,
        maxLength: 128,
        autoSelect: true,
        'aria-label': t('Edit view name'),
      }}
    />
  );
}
