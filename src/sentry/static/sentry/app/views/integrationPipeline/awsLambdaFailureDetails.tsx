import React from 'react';
import styled from '@emotion/styled';

import {IconCheckmark} from 'app/icons';
import {t} from 'app/locale';

import FooterWithButtons from './components/footerWithButtons';
import HeaderWithHelp from './components/headerWithHelp';

type ErrorDetail = {name: string; error: string};

type Props = {
  lambdaFunctionFailures: ErrorDetail[];
  successCount: number;
};

export default function AwsLambdaFailureDetails({
  lambdaFunctionFailures,
  successCount,
}: Props) {
  return (
    <Wrapper>
      <HeaderWithHelp docsUrl="https://docs.sentry.io/product/integrations/aws_lambda/" />
      <IconCheckmark />
      <h3>{t('Update %s functions sucessfully', successCount)}</h3>
      <h3>{t('Failed to update the following Lambda Functions')}</h3>
      {lambdaFunctionFailures.map(SingleFailure)}
      <FooterWithButtons buttonText={t('Finish Setup')} href="?finish_pipeline=1" />
    </Wrapper>
  );
}

function SingleFailure(errorDetail: ErrorDetail) {
  return (
    <StyledRow>
      <span>{errorDetail.name}</span>
      <span>{errorDetail.error}</span>
    </StyledRow>
  );
}

const Wrapper = styled('div')`
  margin: 20px;
`;

const StyledRow = styled('div')`
  padding: 16px;
`;
