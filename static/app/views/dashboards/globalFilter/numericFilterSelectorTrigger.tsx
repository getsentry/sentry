import styled from '@emotion/styled';

import {TermOperator} from 'sentry/components/searchSyntax/parser';
import TextOverflow from 'sentry/components/textOverflow';
import {prettifyTagKey} from 'sentry/utils/fields';
import {getOperatorLabel} from 'sentry/views/dashboards/globalFilter/numericFilterSelector';
import type {GlobalFilter} from 'sentry/views/dashboards/types';

type NumericFilterSelectorTriggerProps = {
  globalFilter: GlobalFilter;
  globalFilterOperator: TermOperator;
  globalFilterValue: string;
};

function NumericFilterSelectorTrigger({
  globalFilter,
  globalFilterOperator,
  globalFilterValue,
}: NumericFilterSelectorTriggerProps) {
  const {tag} = globalFilter;

  return (
    <ButtonLabelWrapper>
      <TextOverflow>
        {prettifyTagKey(tag.key)} {getOperatorLabel(globalFilterOperator)}{' '}
        <FilterValueWrapper>{globalFilterValue}</FilterValueWrapper>
      </TextOverflow>
    </ButtonLabelWrapper>
  );
}

type BetweenFilterSelectorTriggerProps = {
  globalFilter: GlobalFilter;
  lowerBound: string;
  upperBound: string;
};

function BetweenFilterSelectorTrigger({
  globalFilter,
  lowerBound,
  upperBound,
}: BetweenFilterSelectorTriggerProps) {
  const {tag} = globalFilter;
  const operatorLabel = getOperatorLabel(TermOperator.LESS_THAN_EQUAL);

  return (
    <ButtonLabelWrapper>
      <TextOverflow>
        <FilterValueWrapper>{lowerBound}</FilterValueWrapper> {operatorLabel}{' '}
        {prettifyTagKey(tag.key)} {operatorLabel}{' '}
        <FilterValueWrapper>{upperBound}</FilterValueWrapper>
      </TextOverflow>
    </ButtonLabelWrapper>
  );
}

export {NumericFilterSelectorTrigger, BetweenFilterSelectorTrigger};

const ButtonLabelWrapper = styled('span')`
  width: 100%;
  text-align: left;
  align-items: center;
  display: inline-grid;
  grid-template-columns: 1fr auto;
  line-height: 1;
`;

const FilterValueWrapper = styled('span')`
  font-weight: normal;
`;
