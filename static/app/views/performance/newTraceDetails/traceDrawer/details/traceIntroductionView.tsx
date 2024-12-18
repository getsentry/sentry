import styled from '@emotion/styled';

import image from 'sentry-images/spot/tracing-keyboard-shortcuts.svg';

import ExternalLink from 'sentry/components/links/externalLink';
import {IconDocs} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

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
        <p>
          {t(
            `Welcome to the world of distributed tracing! Chances are, you’ve got multiple services connected and acting like dominos.
            Traces help you understand what span operations cascade into another, debugging errors, slowdowns, etc.
            Click any of the bars to get the nitty gritty details of what happened there or learn about some of the most popular workflows from here.`
          )}
        </p>

        <LinksWithImage>
          <LinkSection />
          <ImageWrapper src={image} />
        </LinksWithImage>
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

const LinksWithImage = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
`;

const StyledList = styled('ul')`
  min-width: 200px;
  color: ${p => p.theme.blue300};
`;

const ImageWrapper = styled('img')`
  max-width: 350px;
  min-width: 100px;
`;
