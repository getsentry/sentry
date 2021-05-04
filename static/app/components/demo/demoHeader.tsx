import styled from '@emotion/styled';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import ExternalLink from 'app/components/links/externalLink';
import LogoSentry from 'app/components/logoSentry';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {trackAdvancedAnalyticsEvent} from 'app/utils/advancedAnalytics';

export default function DemoHeader() {
  return (
    <Wrapper>
      <StyledLogoSentry />
      <ButtonBar gap={4}>
        <StyledExternalLink
          onClick={() => trackAdvancedAnalyticsEvent('growth.demo_click_docs', {}, null)}
          href="https://docs.sentry.io"
        >
          {t('Documentation')}
        </StyledExternalLink>
        <BaseButton
          priority="form"
          onClick={() =>
            trackAdvancedAnalyticsEvent('growth.demo_click_request_demo', {}, null)
          }
          href="https://sentry.io/_/demo/"
        >
          {t('Request a Demo')}
        </BaseButton>
        <GetStarted
          onClick={() =>
            trackAdvancedAnalyticsEvent('growth.demo_click_get_started', {}, null)
          }
          href="https://sentry.io/signup/"
        >
          {t('Sign Up for Free')}
        </GetStarted>
      </ButtonBar>
    </Wrapper>
  );
}

//Note many of the colors don't come from the theme as they come from the marketing site
const Wrapper = styled('div')`
  padding-right: ${space(3)};
  background-color: ${p => p.theme.white};
  height: ${p => p.theme.demo.headerSize};
  display: flex;
  justify-content: space-between;
  text-transform: uppercase;
  margin-left: calc(-1 * ${p => p.theme.sidebar.expandedWidth});
  position: fixed;
  width: 100%;
  border-bottom: 1px solid ${p => p.theme.border};
  z-index: ${p => p.theme.zIndex.settingsSidebarNav};

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    height: ${p => p.theme.sidebar.mobileHeight};
    margin-left: 0;
  }
`;

const StyledLogoSentry = styled(LogoSentry)`
  margin-top: auto;
  margin-bottom: auto;
  margin-left: 20px;
  width: 130px;
  height: 30px;
  color: ${p => p.theme.textColor};
`;

const BaseButton = styled(Button)`
  border-radius: 2rem;
  text-transform: uppercase;
`;

//Note many of the colors don't come from the theme as they come from the marketing site
const GetStarted = styled(BaseButton)`
  border-color: transparent;
  box-shadow: 0 2px 0 rgb(54 45 89 / 10%);
  background-color: #e1567c;
  color: #fff;
`;

const StyledExternalLink = styled(ExternalLink)`
  color: #584774;
`;
