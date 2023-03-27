import {browserHistory} from 'react-router';

import EditableText from 'sentry/components/editableText';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {Organization, SavedQuery} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import useApi from 'sentry/utils/useApi';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import {handleUpdateQueryName} from './savedQuery/utils';

type Props = {
  eventView: EventView;
  organization: Organization;
  isHomepage?: boolean;
  savedQuery?: SavedQuery;
};

const NAME_DEFAULT = t('Untitled query');
const HOMEPAGE_DEFAULT = t('New Query');

/**
 * Allows user to edit the name of the query.
 * By pressing Enter or clicking outside the component, the changes will be saved, if valid.
 */
function EventInputName({organization, eventView, savedQuery, isHomepage}: Props) {
  const api = useApi();

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

        browserHistory.push(
          normalizeUrl(renamedEventView.getResultsViewUrlTarget(organization.slug))
        );
      }
    );
  }

  const value = isHomepage ? HOMEPAGE_DEFAULT : eventView.name || NAME_DEFAULT;

  return (
    <Layout.Title data-test-id={`discover2-query-name-${value}`}>
      <EditableText
        value={value}
        onChange={handleChange}
        isDisabled={!eventView.id || isHomepage}
        errorMessage={t('Please set a name for this query')}
      />
    </Layout.Title>
  );
}

export default EventInputName;
