import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import {t} from 'app/locale';

type Props = {
  lambdaFunctionFailures: Array<{FunctionName: string; Runtime: string}>;
};

export default function AwsLambdaFailureDetails({lambdaFunctionFailures}: Props) {
  return (
    <Wrapper>
      <h3>{t('Failed to update the following Lambda Functions')}</h3>
      {lambdaFunctionFailures.map(func => {
        return <div key={func.FunctionName}>{func.FunctionName}</div>;
      })}
      <StyledButton priority="primary" href="?finish_pipeline=1">
        Finish
      </StyledButton>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  margin: 20px;
`;

const StyledButton = styled(Button)`
  margin: 50px;
`;
