import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import {space} from 'sentry/styles/space';
import {useLocation} from 'sentry/utils/useLocation';
import {ModuleName} from 'sentry/views/starfish/types';
import {ActionSelector} from 'sentry/views/starfish/views/spans/selectors/actionSelector';
import {DomainSelector} from 'sentry/views/starfish/views/spans/selectors/domainSelector';
import {SpanOperationSelector} from 'sentry/views/starfish/views/spans/selectors/spanOperationSelector';
import {SpanTimeCharts} from 'sentry/views/starfish/views/spans/spanTimeCharts';

import SpansTable from './spansTable';

const LIMIT: number = 25;

type Props = {
  moduleName?: ModuleName;
  spanCategory?: string;
};

type State = {
  orderBy: string;
};

type Query = {
  'span.action': string;
  'span.domain': string;
  'span.group': string;
  'span.op': string;
};

export default function SpansView(props: Props) {
  const location = useLocation<Query>();
  const appliedFilters = location.query;
  const [state, setState] = useState<State>({orderBy: '-time_spent_percentage'});

  const {orderBy} = state;

  return (
    <Fragment>
      <FilterOptionsContainer>
        <DatePageFilter alignDropdown="left" />
      </FilterOptionsContainer>

      <PaddedContainer>
        <SpanTimeCharts
          moduleName={props.moduleName || ModuleName.ALL}
          appliedFilters={appliedFilters}
          spanCategory={props.spanCategory}
        />
      </PaddedContainer>
      <FilterOptionsContainer>
        <SpanOperationSelector
          moduleName={props.moduleName}
          value={appliedFilters['span.op'] || ''}
          spanCategory={props.spanCategory}
        />

        <DomainSelector
          moduleName={props.moduleName}
          value={appliedFilters['span.domain'] || ''}
          spanCategory={props.spanCategory}
        />

        <ActionSelector
          moduleName={props.moduleName}
          value={appliedFilters['span.action'] || ''}
          spanCategory={props.spanCategory}
        />
      </FilterOptionsContainer>

      <PaddedContainer>
        <SpansTable
          moduleName={props.moduleName || ModuleName.ALL}
          orderBy={orderBy}
          spanCategory={props.spanCategory}
          limit={LIMIT}
        />
      </PaddedContainer>
    </Fragment>
  );
}

const PaddedContainer = styled('div')`
  margin: 0 ${space(2)};
`;

const FilterOptionsContainer = styled(PaddedContainer)`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  margin-bottom: ${space(2)};
`;
