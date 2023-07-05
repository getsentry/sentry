import {Fragment} from 'react';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, PageFilters, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import StarfishDatePicker from 'sentry/views/starfish/components/datePicker';
import {StarfishProjectSelector} from 'sentry/views/starfish/components/starfishProjectSelector';

import {StarfishView} from './starfishView';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  projects: Project[];
  router: InjectedRouter;
  selection: PageFilters;
  withStaticFilters: boolean;
};

export function StarfishLanding(props: Props) {
  const pageFilters: React.ReactNode = (
    <PageFilterBar condensed>
      <StarfishProjectSelector />
      <StarfishDatePicker />
    </PageFilterBar>
  );

  return (
    <Layout.Page>
      <PageErrorProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{t('Web Service')}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main fullWidth>
            <PageErrorAlert />
            <Fragment>
              <SearchContainerWithFilterAndMetrics>
                {pageFilters}
              </SearchContainerWithFilterAndMetrics>

              <StarfishView {...props} />
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
