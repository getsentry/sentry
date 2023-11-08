import {CSSProperties, Fragment} from 'react';
import styled from '@emotion/styled';

import newFeatureImg from 'sentry-images/spot/new-feature.svg';

import {LinkButton} from 'sentry/components/button';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface Props {
  style?: CSSProperties;
}

export default function FeedbackSetupPanel({style}: Props) {
  const docsButton = (
    <LinkButton
      external
      href="https://github.com/getsentry/sentry-javascript/blob/develop/packages/feedback/README.md"
      priority="primary"
    >
      {t('Set Up Now')}
    </LinkButton>
  );

  return (
    <Panel style={style}>
      <Container>
        <IlloBox>
          <img src={newFeatureImg} />
        </IlloBox>
        <StyledBox>
          <Fragment>
            <h3>{t('Introducing the New User Feedback')}</h3>
            <p>
              {t(
                "Users can submit feedback anytime on issues they're experiencing on your app via our feedback widget."
              )}
            </p>
            {docsButton}
          </Fragment>
        </StyledBox>
      </Container>
    </Panel>
  );
}

const Container = styled('div')`
  padding: ${space(3)};
  position: relative;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
    align-items: center;
    flex-direction: row;
    justify-content: center;
    flex-wrap: wrap;
    min-height: 300px;
    max-width: 1000px;
    margin: 0 auto;
  }

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    min-height: 350px;
  }
`;

const StyledBox = styled('div')`
  min-width: 0;
  z-index: 1;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    flex: 2;
  }
`;

const IlloBox = styled(StyledBox)`
  position: relative;
  min-height: 100px;
  max-width: 300px;
  min-width: 150px;
  margin: ${space(2)} auto;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    flex: 1;
    margin: ${space(3)};
    max-width: auto;
  }
`;
