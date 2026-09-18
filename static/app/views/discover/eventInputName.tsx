import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';

import {t} from 'sentry/locale';
import type {Organization, SavedQuery} from 'sentry/types/organization';
import {EventView} from 'sentry/utils/discover/eventView';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';

import {handleUpdateQueryName} from './savedQuery/utils';

type Props = {eventView: EventView; organization: Organization; savedQuery?: SavedQuery};

const NAME_DEFAULT = t('Untitled query');

/**
 * Renders the query name as the page title, editable in place once the query
 * has been saved. By pressing Enter or clicking outside the component, the
 * changes will be saved, if valid.
 */
export function EventInputName({organization, eventView, savedQuery}: Props) {
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
    const nextEventView = EventView.fromSavedQuery({...savedQuery, name: nextQueryName});

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

  const value = eventView.name || NAME_DEFAULT;

  if (!eventView.id) {
    return <BreadcrumbList.Title item={{type: 'page-title', label: value}} />;
  }

  return (
    <BreadcrumbList.Title
      item={{
        type: 'editable-title',
        value,
        onChange: handleChange,
        errorMessage: t('Please set a name for this query'),
        maxLength: 255,
        'aria-label': t('Edit query name'),
      }}
    />
  );
}
