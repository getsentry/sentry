import React from 'react';
import styled from '@emotion/styled';

import {Panel} from 'app/components/panels';
import {IconCheckmark, IconWarning} from 'app/icons';
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
        <ItemWrapper>
          <StyledCheckmark isCircled />
          <h3>{t('Succesfully updated %s functions', successCount)}</h3>
        </ItemWrapper>
        <ItemWrapper>
          <StyledWarning />
          <h3>{t('Failed to update %s functions', lambdaFunctionFailures.length)}</h3>
        </ItemWrapper>
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
  margin-left: 34px;
`;

const ItemWrapper = styled('div')``;

const StyledCheckmark = styled(IconCheckmark)`
  float: left;
  margin-right: 10px;
  color: ${p => p.theme.green300};
  height: 24px;
  width: 24px;
`;

const StyledWarning = styled(IconWarning)`
  float: left;
  margin-right: 10px;
  color: ${p => p.theme.red300};
  height: 24px;
  width: 24px;
`;
