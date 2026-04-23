import {t} from 'sentry/locale';
import type {Organization, SavedQuery} from 'sentry/types/organization';
import {EventView} from 'sentry/utils/discover/eventView';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {EditableViewTitle} from 'sentry/views/issueList/editableIssueViewHeader';

import {handleUpdateQueryName} from './savedQuery/utils';

type Props = {
  eventView: EventView;
  organization: Organization;
  compact?: boolean;
  isHomepage?: boolean;
  savedQuery?: SavedQuery;
};

const NAME_DEFAULT = t('Untitled query');
const HOMEPAGE_DEFAULT = t('New Query');

export function EventInputName({
  compact,
  organization,
  eventView,
  savedQuery,
  isHomepage,
}: Props) {
  const api = useApi();
  const navigate = useNavigate();

  function handleChange(nextQueryName: string) {
    // Do not update automatically if
    // 1) It is a new query
    // 2) The new name is same as the old name
    if (!savedQuery || savedQuery.name === nextQueryName) {
      return;
    }

    // This ensures that we are updating SavedQuery.name only.
    // Changes on QueryBuilder table will not be saved.
    const nextEventView = EventView.fromSavedQuery({
      ...savedQuery,
      name: nextQueryName,
    });

    handleUpdateQueryName(api, organization, nextEventView).then(
      (_updatedQuery: SavedQuery) => {
        // The current eventview may have changes that are not explicitly saved.
        // So, we just preserve them and change its name
        const renamedEventView = eventView.clone();
        renamedEventView.name = nextQueryName;

        navigate(normalizeUrl(renamedEventView.getResultsViewUrlTarget(organization)));
      }
    );
  }

  const value = isHomepage ? HOMEPAGE_DEFAULT : eventView.name || NAME_DEFAULT;

  return (
    <EditableViewTitle
      ariaLabel={t('Edit query name')}
      maxLength={255}
      onSave={handleChange}
      value={value}
      compact={compact}
      containerTestIdPrefix="discover2-query-name"
      errorMessage={t('Please set a name for this query')}
      isDisabled={!eventView.id || Boolean(isHomepage)}
      saveOnBlur
      startEditingOnClick
    />
  );
}
