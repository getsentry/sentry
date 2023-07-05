import {Fragment} from 'react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {space} from 'sentry/styles/space';
import {fromSorts} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {ModuleName} from 'sentry/views/starfish/types';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {ActionSelector} from 'sentry/views/starfish/views/spans/selectors/actionSelector';
import {DomainSelector} from 'sentry/views/starfish/views/spans/selectors/domainSelector';
import {SpanOperationSelector} from 'sentry/views/starfish/views/spans/selectors/spanOperationSelector';
import {SpanTimeCharts} from 'sentry/views/starfish/views/spans/spanTimeCharts';

import SpansTable, {isAValidSort} from './spansTable';

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
    'span.action',
    'span.domain',
    'span.op',
    'span.group',
  ]);

  const sort =
    fromSorts(location.query[QueryParameterNames.SORT]).filter(isAValidSort)[0] ??
    DEFAULT_SORT; // We only allow one sort on this table in this view

  return (
    <Fragment>
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

        <ActionSelector
          moduleName={props.moduleName}
          value={appliedFilters['span.action'] || ''}
          spanCategory={props.spanCategory}
        />

        <DomainSelector
          moduleName={props.moduleName}
          value={appliedFilters['span.domain'] || ''}
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
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  margin-bottom: ${space(2)};
`;
