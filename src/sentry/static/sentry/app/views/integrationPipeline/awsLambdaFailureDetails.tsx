import React from 'react';
import styled from '@emotion/styled';

import {Panel} from 'app/components/panels';
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
    <React.Fragment>
      <HeaderWithHelp docsUrl="https://docs.sentry.io/product/integrations/aws_lambda/" />
      <Wrapper>
        <IconCheckmark />
        <h3>{t('Succesfully updated %s functions', successCount)}</h3>
        <h3>{t('Failed to update %s functions', lambdaFunctionFailures.length)}</h3>
        <StyledPanel>{lambdaFunctionFailures.map(SingleFailure)}</StyledPanel>
      </Wrapper>
      <FooterWithButtons buttonText={t('Finish Setup')} href="?finish_pipeline=1" />
    </React.Fragment>
  );
}

function SingleFailure(errorDetail: ErrorDetail) {
  return (
    <StyledRow>
      <span>{errorDetail.name}</span>
      <Error>{errorDetail.error}</Error>
    </StyledRow>
  );
}

const Wrapper = styled('div')`
  margin: 100px 50px 50px 50px;
`;

const StyledRow = styled('div')`
  padding: 16px;
  background-color: ${p => p.theme.background};
  display: flex;
  flex-direction: column;
  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
    border-radius: inherit;
  }
`;

const Error = styled('span')`
  color: ${p => p.theme.gray300};
`;

const StyledPanel = styled(Panel)`
  overflow: hidden;
`;
