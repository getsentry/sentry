import {Fragment} from 'react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {space} from 'sentry/styles/space';
import {fromSorts} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import StarfishDatePicker from 'sentry/views/starfish/components/datePicker';
import {StarfishProjectSelector} from 'sentry/views/starfish/components/starfishProjectSelector';
import {ModuleName, SpanMetricsFields} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {ActionSelector} from 'sentry/views/starfish/views/spans/selectors/actionSelector';
import {DomainSelector} from 'sentry/views/starfish/views/spans/selectors/domainSelector';
import {SpanOperationSelector} from 'sentry/views/starfish/views/spans/selectors/spanOperationSelector';
import {SpanTimeCharts} from 'sentry/views/starfish/views/spans/spanTimeCharts';

import SpansTable, {isAValidSort} from './spansTable';

const {SPAN_ACTION, SPAN_DOMAIN, SPAN_OP, SPAN_GROUP} = SpanMetricsFields;

const DEFAULT_SORT: Sort = {
  kind: 'desc',
  field: 'time_spent_percentage()',
};
const LIMIT: number = 25;

type Props = {
  moduleName?: ModuleName;
  spanCategory?: string;
};

type Query = {
  'span.action': string;
  'span.domain': string;
  'span.group': string;
  'span.op': string;
  [QueryParameterNames.SORT]: string;
};

export default function SpansView(props: Props) {
  const location = useLocation<Query>();
  const appliedFilters = pick(location.query, [
    SPAN_ACTION,
    SPAN_DOMAIN,
    SPAN_OP,
    SPAN_GROUP,
  ]);

  const sort =
    fromSorts(location.query[QueryParameterNames.SORT]).filter(isAValidSort)[0] ??
    DEFAULT_SORT; // We only allow one sort on this table in this view

  return (
    <Fragment>
      <StyledPageFilterBar condensed>
        <StarfishProjectSelector />
        <StarfishDatePicker />
      </StyledPageFilterBar>

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
          value={appliedFilters[SPAN_OP] || ''}
          spanCategory={props.spanCategory}
        />

        <ActionSelector
          moduleName={props.moduleName}
          value={appliedFilters[SPAN_ACTION] || ''}
          spanCategory={props.spanCategory}
        />

        <DomainSelector
          moduleName={props.moduleName}
          value={appliedFilters[SPAN_DOMAIN] || ''}
          spanCategory={props.spanCategory}
        />
      </FilterOptionsContainer>

      <PaddedContainer>
        <SpansTable
          moduleName={props.moduleName || ModuleName.ALL}
          spanCategory={props.spanCategory}
          sort={sort}
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
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: ${space(1)};
  margin-bottom: ${space(2)};
  max-width: 700px;
`;

const StyledPageFilterBar = styled(PageFilterBar)`
  margin: 0 ${space(2)};
  margin-bottom: ${space(2)};
`;
