import styled from '@emotion/styled';

import onboardingSetup from 'sentry-images/spot/onboarding-setup.svg';

import {LinkButton} from 'sentry/components/button';
import {TAGS_DOCS_LINK} from 'sentry/components/events/eventTags/util';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export default function EventTagCustomBanner() {
  return (
    <Wrapper data-test-id="event-tags-custom-banner">
      <Body>
        <div>
          <Title>{t('Debug better with custom tags')}</Title>
          <SubTitle>
            {t('Include relevant metadata for debugging on events you send to Sentry')}
          </SubTitle>
        </div>
        <ContextArea>
          <LinkButton size="sm" href={TAGS_DOCS_LINK} external>
            {t('Learn More')}
          </LinkButton>
        </ContextArea>
      </Body>
      <SentaurIllustration src={onboardingSetup} />
    </Wrapper>
  );
}

const Wrapper = styled(Panel)`
  margin-bottom: 0;
  background: linear-gradient(
    269.35deg,
    ${p => p.theme.backgroundTertiary} 0.32%,
    rgba(245, 243, 247, 0) 99.69%
  );
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Body = styled(PanelBody)`
  padding: ${space(2)} ${space(3)};
  flex: 1;
  max-width: 350px;
`;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: bold;
  margin-bottom: ${space(1)};
`;

const SubTitle = styled('p')`
  margin: ${space(1)} 0;
`;

const ContextArea = styled('div')`
  display: flex;
  gap: ${space(1)};
  margin-top: ${space(1)};
`;

const SentaurIllustration = styled('img')`
  height: 150px;
  margin: 20px 20px 10px 10px;
  pointer-events: none;
  justify-self: end;
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;
