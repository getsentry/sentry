import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import feedbackOnboardingImg from 'sentry-images/spot/feedback-onboarding.svg';

import {LinkButton} from 'sentry/components/button';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

export default function FeedbackSetupPanel() {
  const organization = useOrganization();

  useEffect(() => {
    trackAnalytics('feedback.index-setup-viewed', {
      organization,
    });
  }, [organization]);

  return (
    <NoMarginPanel>
      <Container>
        <IlloBox>
          <img src={feedbackOnboardingImg} />
        </IlloBox>
        <StyledBox>
          <Fragment>
            <h3>{t('Introducing the New User Feedback')}</h3>
            <p>
              {t(
                'Allow your users to create bug reports so they can let you know about these sneaky issues right away. Every report will automatically include related replays, tags, and errors, making fixing the issue dead simple.'
              )}
            </p>
            <LinkButton
              external
              href="https://docs.sentry.io/product/user-feedback/setup/"
              priority="primary"
              analyticsEventName="Clicked Feedback Onboarding Setup Button"
              analyticsEventKey="feedback.index-setup-button-clicked"
              analyticsParams={{surface: 'setup-panel'}}
            >
              {t('Set Up Now')}
            </LinkButton>
          </Fragment>
        </StyledBox>
      </Container>
    </NoMarginPanel>
  );
}

const NoMarginPanel = styled(Panel)`
  max-height: 100%;
  overflow: scroll;
  margin: 0;
`;

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
