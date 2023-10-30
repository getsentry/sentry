import {Fragment} from 'react';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, PageFilters} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {STARFISH_TYPE_FOR_PROJECT} from 'sentry/views/starfish/allowedProjects';
import StarfishDatePicker from 'sentry/views/starfish/components/datePicker';
import {ReleaseSelector} from 'sentry/views/starfish/components/releaseSelector';
import {StarfishProjectSelector} from 'sentry/views/starfish/components/starfishProjectSelector';
import {StarfishType} from 'sentry/views/starfish/types';
import {MobileStarfishView} from 'sentry/views/starfish/views/mobileServiceView';

import {StarfishView} from './starfishView';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  router: InjectedRouter;
  selection: PageFilters;
  withStaticFilters: boolean;
};

export type BaseStarfishViewProps = {
  eventView: EventView;
  location: Location;
  organization: Organization;
};

export function StarfishLanding(props: Props) {
  const project = props.selection.projects[0];
  const starfishType = STARFISH_TYPE_FOR_PROJECT[project] || StarfishType.BACKEND;

  const pageFilters: React.ReactNode = (
    <Fragment>
      <PageFilterBar condensed>
        <StarfishProjectSelector />
        <StarfishDatePicker />
      </PageFilterBar>
      {starfishType === StarfishType.MOBILE && (
        <PageFilterBar condensed>
          <ReleaseSelector
            selectorKey="primaryRelease"
            selectorName={t('Primary Release')}
          />
          <ReleaseSelector
            selectorKey="secondaryRelease"
            selectorName={t('Secondary Release')}
          />
        </PageFilterBar>
      )}
    </Fragment>
  );

  const getStarfishView = () => {
    switch (starfishType) {
      case StarfishType.MOBILE:
        return MobileStarfishView;
      case StarfishType.BACKEND:
      default:
        return StarfishView;
    }
  };

  const getStarfishPageTitle = () => {
    switch (starfishType) {
      case StarfishType.MOBILE:
        return t('Mobile Application');
      case StarfishType.BACKEND:
      default:
        return t('Web Service');
    }
  };

  const StarfishComponent = getStarfishView();

  return (
    <Layout.Page>
      <PageErrorProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{getStarfishPageTitle()}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main fullWidth>
            <PageErrorAlert />
            <Fragment>
              <SearchContainerWithFilterAndMetrics>
                {pageFilters}
              </SearchContainerWithFilterAndMetrics>

              <StarfishComponent {...props} />
            </Fragment>
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}

const SearchContainerWithFilterAndMetrics = styled('div')`
  display: grid;
  grid-template-rows: auto auto auto;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-rows: auto;
    grid-template-columns: auto 1fr auto;
  }
`;
