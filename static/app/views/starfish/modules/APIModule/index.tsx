import {useState} from 'react';
import {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import EndpointDetail from 'sentry/views/starfish/views/endpointDetails';

import APIModuleView, {DataRow} from './APIModuleView';

type APIModuleState = {
  selectedRow?: DataRow;
};

type Props = {
  location: Location;
};

export default function APIModule(props: Props) {
  const [state, setState] = useState<APIModuleState>({selectedRow: undefined});
  const unsetSelectedSpanGroup = () => setState({selectedRow: undefined});
  const {selectedRow} = state;
  const setSelectedRow = (row: DataRow) => setState({selectedRow: row});
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
            <APIModuleView {...props} onSelect={setSelectedRow} />
            <EndpointDetail row={selectedRow} onClose={unsetSelectedSpanGroup} />
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}
