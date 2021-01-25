import React from 'react';
import styled from '@emotion/styled';

import {Panel, PanelItem} from 'app/components/panels';
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
        <div>
          <StyledCheckmark isCircled color="green300" />
          <h3>{t('Succesfully updated %s functions', successCount)}</h3>
        </div>
        <div>
          <StyledWarning color="red300" />
          <h3>{t('Failed to update %s functions', lambdaFunctionFailures.length)}</h3>
        </div>
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

const StyledRow = styled(PanelItem)`
  display: flex;
  flex-direction: column;
`;

const Error = styled('span')`
  color: ${p => p.theme.subText};
`;

const StyledPanel = styled(Panel)`
  overflow: hidden;
  margin-left: 34px;
`;

const StyledCheckmark = styled(IconCheckmark)`
  float: left;
  margin-right: 10px;
  height: 24px;
  width: 24px;
`;

const StyledWarning = styled(IconWarning)`
  float: left;
  margin-right: 10px;
  height: 24px;
  width: 24px;
`;
