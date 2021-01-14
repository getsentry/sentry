import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {DynamicSamplingCondition} from 'app/types/dynamicSampling';

import {getOperatorLabel} from './utils';

type Props = {
  conditions: Array<DynamicSamplingCondition>;
};

function Conditions({conditions}: Props) {
  function getConvertedValue(value: DynamicSamplingCondition['value']) {
    if (Array.isArray(value)) {
      return (
        <Values>
          {value.map((v, index) => (
            <React.Fragment key={v}>
              <Value>{v}</Value>
              {index !== value.length - 1 && <Separator>{'\u002C'}</Separator>}
            </React.Fragment>
          ))}
        </Values>
      );
    }

    return <Value>{String(value)}</Value>;
  }

  return (
    <Wrapper>
      {conditions.map(({operator, value}, index) => (
        <Condition key={index}>
          {getOperatorLabel(operator)}
          {getConvertedValue(value)}
        </Condition>
      ))}
    </Wrapper>
  );
}

export default Conditions;

const Wrapper = styled('div')`
  display: grid;
  grid-gap: ${space(1.5)};
`;

const Condition = styled(Wrapper)`
  grid-template-columns: max-content 1fr;
`;

const Values = styled('div')`
  display: flex;
`;

const Value = styled('div')`
  color: ${p => p.theme.gray300};
`;

const Separator = styled(Value)`
  color: ${p => p.theme.gray200};
  padding-right: ${space(0.5)};
`;
