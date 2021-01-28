import React from 'react';
import styled from '@emotion/styled';

import ExternalLink from 'app/components/links/externalLink';
import {Panel, PanelItem} from 'app/components/panels';
import {IconCheckmark, IconWarning} from 'app/icons';
import {t, tct, tn} from 'app/locale';

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
  const baseDocsUrl = 'https://docs.sentry.io/product/integrations/aws_lambda/';
  return (
    <React.Fragment>
      <HeaderWithHelp docsUrl={baseDocsUrl} />
      <Wrapper>
        <div>
          <StyledCheckmark isCircled color="green300" />
          <h3>
            {tn(
              'Succesfully updated %s function',
              'Succesfully updated %s functions',
              successCount
            )}
          </h3>
        </div>
        <div>
          <StyledWarning color="red300" />
          <h3>
            {tn(
              'Failed to update %s function',
              'Failed to update %s functions',
              lambdaFunctionFailures.length
            )}
          </h3>
          <Troubleshooting>
            {tct('See [link:Troubleshooting Docs]', {
              link: <ExternalLink href={baseDocsUrl + '#troubleshooting'} />,
            })}
          </Troubleshooting>
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

const Troubleshooting = styled('p')`
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
