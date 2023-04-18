import {useState} from 'react';
import {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import APIDetail from 'sentry/views/starfish/views/endpointDetails';

import APIModuleView from './APIModuleView';

type APIModuleState = {
  spanGroup?: string;
};

type Props = {
  location: Location;
};

export default function APIModule(props: Props) {
  const [state, setState] = useState<APIModuleState>({spanGroup: undefined});
  const unsetSelectedSpanGroup = () => setState({spanGroup: undefined});
  const {spanGroup} = state;
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
            <APIModuleView {...props} />
            <button onClick={() => setState({spanGroup: '1'})}>Test</button>
            <APIDetail spanGroup={spanGroup} onClose={unsetSelectedSpanGroup} />
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}
