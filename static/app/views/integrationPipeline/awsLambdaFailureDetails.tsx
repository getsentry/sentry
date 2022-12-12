import {Fragment} from 'react';
import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import {Panel, PanelItem} from 'sentry/components/panels';
import {IconCheckmark, IconWarning} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';

import FooterWithButtons from './components/footerWithButtons';
import HeaderWithHelp from './components/headerWithHelp';

type ErrorDetail = {error: string; name: string};

type Props = {
  lambdaFunctionFailures: ErrorDetail[];
  successCount: number;
};

export default function AwsLambdaFailureDetails({
  lambdaFunctionFailures,
  successCount,
}: Props) {
  const baseDocsUrl =
    'https://docs.sentry.io/product/integrations/cloud-monitoring/aws-lambda/';
  return (
    <Fragment>
      <HeaderWithHelp docsUrl={baseDocsUrl} />
      <Wrapper>
        <div>
          <StyledCheckmark isCircled color="successText" />
          <h3>
            {tn(
              'successfully updated %s function',
              'successfully updated %s functions',
              successCount
            )}
          </h3>
        </div>
        <div>
          <StyledWarning color="errorText" />
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
    </Fragment>
  );
}

function SingleFailure(errorDetail: ErrorDetail) {
  return (
    <StyledRow key={errorDetail.name}>
      <span>{errorDetail.name}</span>
      <Error>{errorDetail.error}</Error>
    </StyledRow>
  );
}

const Wrapper = styled('div')`
  padding: 100px 50px 50px 50px;
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
