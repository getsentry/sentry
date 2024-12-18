import styled from '@emotion/styled';

import image from 'sentry-images/spot/tracing-keyboard-shortcuts.svg';

import ExternalLink from 'sentry/components/links/externalLink';
import {IconDocs} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  KEYBOARD_SHORTCUTS,
  ShortcutsLayout,
  Shortcuts,
  TIMELINE_SHORTCUTS,
} from 'sentry/views/performance/newTraceDetails/traceShortcutsModal';

export function TraceIntroductionView() {
  return (
    <MainContainer>
      <HeaderContainer>
        <TitleWrapper>
          <Title>{t('Trace All The Things')}</Title>
          <Subtitle>{t('Intro to Workflows & Shortcuts')}</Subtitle>
        </TitleWrapper>
        <IconDocs size="sm" />
      </HeaderContainer>

      <ContentWrapper>
        <InfoText>
          {t(
            `Welcome to the world of distributed tracing! Chances are, you’ve got multiple services connected and acting like dominos.
            Traces help you understand what span operations cascade into another, debugging errors, slowdowns, etc.
            Click any of the bars to get the nitty gritty details of what happened there or learn about some of the most popular workflows from here.`
          )}
        </InfoText>

        <LinksWithImage>
          <LinkSection />
          <ImageWrapper src={image} alt={t('Sentry cant fix this')} />
        </LinksWithImage>

        <ShortcutSection>
          <ShortcutsLayout>
            <div>
              <Shortcuts>
                {KEYBOARD_SHORTCUTS.map(([key, description]) => (
                  <Shortcut key={key}>
                    <strong>{key}</strong>
                    <div>{description}</div>
                  </Shortcut>
                ))}
                {TIMELINE_SHORTCUTS.map(([key, description]) => (
                  <Shortcut key={key}>
                    <strong>{key}</strong>
                    <div>{description}</div>
                  </Shortcut>
                ))}
              </Shortcuts>
            </div>
          </ShortcutsLayout>
        </ShortcutSection>
      </ContentWrapper>
    </MainContainer>
  );
}

function LinkSection() {
  return (
    <StyledList>
      <li>
        <ExternalLink
          openInNewTab
          href="https://docs.sentry.io/workflows/traces/workflows/"
        >
          {t('How to debug an error')}
        </ExternalLink>
      </li>
      <li>
        <ExternalLink
          openInNewTab
          href="https://docs.sentry.io/workflows/traces/workflows/"
        >
          {t('How to find dependencies')}
        </ExternalLink>
      </li>
      <li>
        <ExternalLink
          openInNewTab
          href="https://docs.sentry.io/workflows/traces/workflows/"
        >
          {t('What the heck is LCP?')}
        </ExternalLink>
      </li>
      <li>
        <ExternalLink
          openInNewTab
          href="https://docs.sentry.io/workflows/traces/workflows/"
        >
          {t('What the heck is FCP?')}
        </ExternalLink>
      </li>
      <li>
        <ExternalLink
          openInNewTab
          href="https://docs.sentry.io/workflows/traces/workflows/"
        >
          {t('What the heck is TTFB?')}
        </ExternalLink>
      </li>
      <li>
        <ExternalLink
          openInNewTab
          href="https://docs.sentry.io/workflows/traces/workflows/"
        >
          {t('How to yada yada yada')}
        </ExternalLink>
      </li>
    </StyledList>
  );
}

const MainContainer = styled('div')`
  display: flex;
  flex-direction: column;
  padding: ${space(3)};
`;

const HeaderContainer = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
`;

const TitleWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  margin-bottom: ${space(2)};
`;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const Subtitle = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.subText};
`;

const ContentWrapper = styled('div')`
  display: flex;
  flex-direction: column;

  font-size: ${p => p.theme.fontSizeMedium};
`;

const InfoText = styled('div')`
  margin-bottom: ${space(3)};
`;

const LinksWithImage = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;

  margin-bottom: ${space(3)};
`;

const StyledList = styled('ul')`
  min-width: 200px;
  color: ${p => p.theme.blue300};
`;

const ImageWrapper = styled('img')`
  max-width: 400px;
  max-height: 400px;

  min-width: 100px;
  min-height: 100px;
`;

const ShortcutSection = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(2)};
`;

const Shortcut = styled('li')`
  height: 28px;
  display: grid;
  grid-template-columns: min-content 1fr;

  strong {
    display: inline-block;
    min-width: 130px;
  }

  div {
    min-width: 150px;
  }
`;
