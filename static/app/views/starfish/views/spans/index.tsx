import {useState} from 'react';
import {RouteComponentProps} from 'react-router';
import {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import SpanDetail from 'sentry/views/starfish/views/spans/spanDetails';
import {SpanDataRow} from 'sentry/views/starfish/views/spans/spansTable';

import SpansView from './spansView';

type State = {
  selectedRow?: SpanDataRow;
};

type Props = {
  location: Location;
} & RouteComponentProps<{groupId: string}, {}>;

export default function Spans(props: Props) {
  const [state, setState] = useState<State>({selectedRow: undefined});
  const unsetSelectedSpanGroup = () => setState({selectedRow: undefined});
  const {selectedRow} = state;
  const setSelectedRow = (row: SpanDataRow) => setState({selectedRow: row});
  return (
    <Layout.Page>
      <PageErrorProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{t('Spans')}</Layout.Title>
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main fullWidth>
            <PageErrorAlert />
            <SpansView location={props.location} onSelect={setSelectedRow} />
            <SpanDetail row={selectedRow} onClose={unsetSelectedSpanGroup} />
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}
