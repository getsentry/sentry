import {useState} from 'react';
import {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {t} from 'sentry/locale';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import EndpointDetail, {
  EndpointDataRow,
} from 'sentry/views/starfish/views/endpointDetails';

import APIModuleView from './APIModuleView';

type APIModuleState = {
  selectedRow?: EndpointDataRow;
};

type Props = {
  location: Location;
};

export default function APIModule(props: Props) {
  const [state, setState] = useState<APIModuleState>({selectedRow: undefined});
  const unsetSelectedSpanGroup = () => setState({selectedRow: undefined});
  const {selectedRow} = state;
  const setSelectedRow = (row: EndpointDataRow) => setState({selectedRow: row});
  return (
    <Layout.Page>
      <PageErrorProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{t('API')}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main fullWidth>
            <PageErrorAlert />
            <PageFiltersContainer>
              <APIModuleView {...props} onSelect={setSelectedRow} />
              <EndpointDetail row={selectedRow} onClose={unsetSelectedSpanGroup} />
            </PageFiltersContainer>
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}
