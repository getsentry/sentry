import {css} from '@emotion/react';
import styled from '@emotion/styled';

import onboardingSetup from 'sentry-images/spot/onboarding-setup.svg';

import {LinkButton} from '@sentry/scraps/button';
import {Image} from '@sentry/scraps/image';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {TAGS_DOCS_LINK} from 'sentry/components/events/eventTags/util';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';

export function EventTagCustomBanner() {
  return (
    <Wrapper data-test-id="event-tags-custom-banner">
      <Body>
        <Stack gap="md">
          <Text as="div" size="xl" bold>
            {t('Debug better with custom tags')}
          </Text>
          <Text as="p">
            {t('Include relevant metadata for debugging on events you send to Sentry')}
          </Text>
          <Flex gap="md">
            <LinkButton size="sm" href={TAGS_DOCS_LINK} external>
              {t('Learn More')}
            </LinkButton>
          </Flex>
        </Stack>
      </Body>
      <Image
        src={onboardingSetup}
        alt={t('Sentry mascot setting up an app')}
        height="150px"
        width="auto"
        css={theme => css`
          margin: 20px 20px 10px 10px;
          pointer-events: none;
          justify-self: end;
          @container (max-width: ${theme.container.xl}) {
            display: none;
          }
        `}
      />
    </Wrapper>
  );
}

const Wrapper = styled(Panel)`
  margin-bottom: 0;
  background: linear-gradient(
    269.35deg,
    ${p => p.theme.tokens.background.tertiary} 0.32%,
    rgba(245, 243, 247, 0) 99.69%
  );
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const Body = styled(PanelBody)`
  padding: ${p => p.theme.space.xl} ${p => p.theme.space['2xl']};
  flex: 1;
  max-width: 350px;
`;
