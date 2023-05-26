import {useState} from 'react';
import {RouteComponentProps} from 'react-router';
import {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {t} from 'sentry/locale';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';
import {ModuleName} from 'sentry/views/starfish/types';
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
  const router = useRouter();
  const location = useLocation();
  const [state, setState] = useState<State>({selectedRow: undefined});
  const unsetSelectedSpanGroup = () => {
    router.replace({
      pathname: location.pathname,
      query: {...location.query, group_id: undefined},
    });
    setState({selectedRow: undefined});
  };
  const {selectedRow} = state;
  const setSelectedRow = (row: SpanDataRow) => {
    router.replace({
      pathname: location.pathname,
      query: {...location.query, group_id: row.group_id},
    });
    setState({selectedRow: row});
  };

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
            <PageFiltersContainer>
              <SpansView
                location={props.location}
                onSelect={setSelectedRow}
                moduleName={props.location.query.moduleName ?? ModuleName.ALL}
                appliedFilters={props.location.query}
              />
              <SpanDetail row={selectedRow} onClose={unsetSelectedSpanGroup} />
            </PageFiltersContainer>
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}
