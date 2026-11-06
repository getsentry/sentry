import {Fragment} from 'react';
import styled from '@emotion/styled';

import type {AggregateFilter} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';

import {useAggregateParamVisual} from './useAggregateParamVisual';

export function AggregateKeyVisual({token}: {token: AggregateFilter}) {
  const fnName = getKeyName(token.key);
  const fnParams = useAggregateParamVisual({token});

  return (
    <Fragment>
      <FnName>{fnName}</FnName>
      {'('}
      <Parameters>{fnParams}</Parameters>
      {')'}
    </Fragment>
  );
}

const FnName = styled('span')`
  color: ${p => p.theme.colors.green500};
`;

export const Parameters = styled('span')`
  height: 100%;
`;
