import {Fragment, useCallback, useEffect, useState} from 'react';
import type {Location} from 'history';

import {fetchSavedQuery} from 'sentry/actionCreators/discoverSavedQueries';
import {DocumentationHint} from 'sentry/components/documentationHint';
import {t} from 'sentry/locale';
import type {Organization, SavedQuery} from 'sentry/types/organization';
import type {EventView} from 'sentry/utils/discover/eventView';
import {useApi} from 'sentry/utils/useApi';
import {DiscoverBreadcrumb} from 'sentry/views/discover/breadcrumb';
import {getSavedQueryWithDataset} from 'sentry/views/discover/savedQuery/utils';
import {TopBar} from 'sentry/views/navigation/topBar';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  isHomepage?: boolean;
};

export function ResultsHeader({eventView, location, organization, isHomepage}: Props) {
  const api = useApi();
  const [savedQuery, setSavedQueryState] = useState<SavedQuery | undefined>(undefined);

  const fetchData = useCallback(() => {
    if (!isHomepage && typeof eventView.id === 'string') {
      fetchSavedQuery(api, organization.slug, eventView.id).then(fetchedSavedQuery => {
        setSavedQueryState(getSavedQueryWithDataset(fetchedSavedQuery));
      });
    }
  }, [api, eventView.id, isHomepage, organization.slug]);

  useEffect(() => {
    if (!isHomepage && eventView.id) {
      fetchData();
    }
  }, [eventView.id, isHomepage, fetchData]);

  const hasDiscoverQueryFeature = organization.features.includes('discover-query');

  return (
    <Fragment>
      {!isHomepage && hasDiscoverQueryFeature ? (
        // Owns both the breadcrumbs and title slots.
        <DiscoverBreadcrumb
          eventView={eventView}
          organization={organization}
          location={location}
          savedQuery={savedQuery}
        />
      ) : (
        <TopBar.Slot
          name="breadcrumbs"
          title={{
            type: 'page-title',
            label: t('Errors'),
            labelTooltip: (
              <DocumentationHint docsUrl="https://docs.sentry.io/product/discover-queries/">
                {t('Create queries to get insights into the health of your system.')}
              </DocumentationHint>
            ),
          }}
        />
      )}
    </Fragment>
  );
}
