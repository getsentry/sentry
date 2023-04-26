import {Fragment, useState} from 'react';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import DatePageFilter from 'sentry/components/datePageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import ProjectPageFilter from 'sentry/components/projectPageFilter';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, PageFilters, Project} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import EndpointDetail, {
  EndpointDataRow,
} from 'sentry/views/starfish/views/webServiceView/endpointDetails';

import {StarfishView} from './starfishView';

type WebServiceViewState = {
  selectedRow?: EndpointDataRow;
};

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
      <ProjectPageFilter />
      <DatePageFilter alignDropdown="left" />
    </PageFilterBar>
  );

  const [state, setState] = useState<WebServiceViewState>({selectedRow: undefined});
  const unsetSelectedEndpoint = () => setState({selectedRow: undefined});
  const {selectedRow} = state;
  const setSelectedEndpoint = (row: EndpointDataRow) => setState({selectedRow: row});

  return (
    <Layout.Page>
      <PageErrorProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{t('Starfish')}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main fullWidth>
            <PageErrorAlert />
            <Fragment>
              <SearchContainerWithFilterAndMetrics>
                {pageFilters}
              </SearchContainerWithFilterAndMetrics>

              <StarfishView {...props} onSelect={setSelectedEndpoint} />
              <EndpointDetail
                row={selectedRow}
                onClose={unsetSelectedEndpoint}
                eventView={props.eventView}
                organization={props.organization}
              />
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
