import {useState} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {Filter} from 'sentry/views/starfish/views/spans/filter';
import SpanDetail from 'sentry/views/starfish/views/spans/spanDetails';
import {SpanDataRow} from 'sentry/views/starfish/views/spans/spansTable';

import SpansView, {SPAN_FILTER_KEY_LABELS} from './spansView';

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

  const appliedFilters = Object.keys(props.location.query)
    .map(queryKey => {
      const queryKeyLabel = SPAN_FILTER_KEY_LABELS[queryKey];
      const queryValue = props.location.query[queryKey];

      return queryKeyLabel && queryValue
        ? {kkey: queryKeyLabel, value: queryValue}
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <Layout.Page>
      <PageErrorProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Layout.Title>{t('Spans')}</Layout.Title>
            {appliedFilters.length > 0 ? (
              <FiltersContainer>
                Applied Filters:
                {appliedFilters.map(filterProps => {
                  return <Filter key={filterProps.kkey} {...filterProps} />;
                })}
              </FiltersContainer>
            ) : null}
          </Layout.HeaderContent>
        </Layout.Header>

        <Layout.Body>
          <Layout.Main fullWidth>
            <PageErrorAlert />
            <PageFiltersContainer>
              <SpansView location={props.location} onSelect={setSelectedRow} />
              <SpanDetail row={selectedRow} onClose={unsetSelectedSpanGroup} />
            </PageFiltersContainer>
          </Layout.Main>
        </Layout.Body>
      </PageErrorProvider>
    </Layout.Page>
  );
}

const FiltersContainer = styled('span')`
  display: flex;
  gap: ${space(1)};
  padding: ${space(1)};
`;
