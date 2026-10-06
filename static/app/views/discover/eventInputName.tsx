import type {Location} from 'history';
import omit from 'lodash/omit';

import {BreadcrumbList} from '@sentry/scraps/breadcrumbList';

import {t} from 'sentry/locale';
import type {Organization, SavedQuery} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import {EventView} from 'sentry/utils/discover/eventView';
import {getDiscoverLandingUrl} from 'sentry/utils/discover/urls';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {makeDiscoverPathname} from 'sentry/views/discover/pathnames';
import {TopBar} from 'sentry/views/navigation/topBar';

import {handleUpdateQueryName} from './savedQuery/utils';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  savedQuery?: SavedQuery;
};

const NAME_DEFAULT = t('Untitled query');

/**
 * Renders the query name as the page title, editable in place once the query
 * has been saved. By pressing Enter or clicking outside the component, the
 * changes will be saved, if valid.
 */
export function EventInputName({location, organization, eventView, savedQuery}: Props) {
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

  const value = eventView.name || NAME_DEFAULT;
  const discoverTarget = organization.features.includes('discover-query')
    ? {
        pathname: getDiscoverLandingUrl(organization),
        query: {
          ...omit(location.query, 'homepage'),
          ...eventView.generateBlankQueryStringObject(),
          ...eventView.getPageFiltersQuery(),
        },
      }
    : null;

  return (
    <TopBar.Slot
      name="breadcrumbs"
      title={
        eventView.id
          ? {
              type: 'editable-title',
              value,
              onChange: handleChange,
              errorMessage: t('Please set a name for this query'),
              maxLength: 255,
              'aria-label': t('Edit query name'),
            }
          : {type: 'page-title', label: value}
      }
    >
      <BreadcrumbList
        items={[
          ...(discoverTarget
            ? [{type: 'link' as const, label: t('Errors'), to: discoverTarget}]
            : []),
          ...(defined(eventView.id)
            ? [
                {
                  type: 'link' as const,
                  label: t('Saved Queries'),
                  to: makeDiscoverPathname({path: '/queries/', organization}),
                },
              ]
            : []),
        ]}
      />
    </TopBar.Slot>
  );
}
