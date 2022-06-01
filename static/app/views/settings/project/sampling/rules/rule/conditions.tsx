import {Fragment} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import space from 'sentry/styles/space';
import {
  SamplingCondition,
  SamplingConditionLogicalInner,
  SamplingConditionOperator,
} from 'sentry/types/sampling';

import {getInnerNameLabel, LEGACY_BROWSER_LIST} from '../../utils';

type Props = {
  condition: SamplingCondition;
};

export function Conditions({condition}: Props) {
  function getConvertedValue(value: SamplingConditionLogicalInner['value']) {
    if (Array.isArray(value)) {
      return (
        <Fragment>
          {[...value].map((v, index) => (
            <Fragment key={v}>
              <Value>{LEGACY_BROWSER_LIST[v]?.title ?? v}</Value>
              {index !== value.length - 1 && <Separator>{'\u002C'}</Separator>}
            </Fragment>
          ))}
        </Fragment>
      );
    }

    return <Value>{LEGACY_BROWSER_LIST[String(value)]?.title ?? String(value)}</Value>;
  }

  switch (condition.op) {
    case SamplingConditionOperator.AND: {
      const {inner} = condition;

      if (!inner.length) {
        return null;
      }

      return (
        <Wrapper>
          {inner.map((innerItem, index) => (
            <div key={index}>
              <Label>{getInnerNameLabel(innerItem.name)}</Label>
              {getConvertedValue(innerItem.value)}
            </div>
          ))}
        </Wrapper>
      );
    }
    default: {
      Sentry.captureException(new Error('Unknown sampling condition operator'));
      return null; // this shall not happen
    }
  }
}

const Wrapper = styled('div')`
  display: grid;
  gap: ${space(1.5)};
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
