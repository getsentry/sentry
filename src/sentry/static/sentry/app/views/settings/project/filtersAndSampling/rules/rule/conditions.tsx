import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {
  DynamicSamplingCondition,
  DynamicSamplingConditionLogicalNot,
  DynamicSamplingConditionLogicalOthers,
  DynamicSamplingConditionOperator,
  DynamicSamplingConditionOthers,
} from 'app/types/dynamicSampling';

import {getOperatorLabel} from './utils';

type Props = {
  condition: DynamicSamplingCondition;
};

function Conditions({condition}: Props) {
  function getConvertedValue(value: Array<string>) {
    if (Array.isArray(value)) {
      return (
        <React.Fragment>
          {value.map((v, index) => (
            <React.Fragment key={v}>
              <Value>{v}</Value>
              {index !== value.length - 1 && <Separator>{'\u002C'}</Separator>}
            </React.Fragment>
          ))}
        </React.Fragment>
      );
    }

    return <Value>{String(value)}</Value>;
  }

  switch (condition.operator) {
    case DynamicSamplingConditionOperator.AND:
    case DynamicSamplingConditionOperator.OR: {
      const {inner: conditions} = condition as DynamicSamplingConditionLogicalOthers;
      return (
        <Wrapper>
          {conditions.map(({operator, value}, index) => (
            <div key={index}>
              <Label>{getOperatorLabel(operator)}</Label>
              {getConvertedValue(value)}
            </div>
          ))}
        </Wrapper>
      );
    }
    case DynamicSamplingConditionOperator.NOT: {
      const {inner} = condition as DynamicSamplingConditionLogicalNot;
      const {operator, value} = inner;
      return (
        <div>
          <Label>{getOperatorLabel(operator)}</Label>
          {getConvertedValue(value)}
        </div>
      );
    }
    default: {
      const {operator, value} = condition as DynamicSamplingConditionOthers;
      return (
        <div>
          <Label>{getOperatorLabel(operator)}</Label>
          {getConvertedValue(value)}
        </div>
      );
    }
  }
}

export default Conditions;

const Wrapper = styled('div')`
  display: grid;
  grid-gap: ${space(1.5)};
`;

const Label = styled('span')`
  margin-right: ${space(1)};
`;

const Value = styled('span')`
  word-break: break-all;
  white-space: pre-wrap;
  color: ${p => p.theme.gray300};
`;

const Separator = styled(Value)`
  padding-right: ${space(0.5)};
`;
