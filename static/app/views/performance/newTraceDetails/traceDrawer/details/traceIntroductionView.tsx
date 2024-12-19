import styled from '@emotion/styled';

import image from 'sentry-images/spot/tracing-keyboard-shortcuts.svg';

import ExternalLink from 'sentry/components/links/externalLink';
import {IconDocs} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  KEYBOARD_SHORTCUTS,
  Shortcuts,
  ShortcutsLayout,
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
          <p>
            {t(
              `If you’re seeing this, it means you’ve successfully set up Tracing in your SDK. Nice!`
            )}
          </p>

          <p>
            <strong>{t('What is this? ')}</strong>
            {t(`
              A trace is a map of everything that happens when a request moves through your stack—browser sessions, function calls, db queries, and third-party api requests.
              Each recorded step is a “span” with timestamps and metadata. Put these spans together, and you get a “trace” showing how your system handled the request from start to finish.
            `)}
          </p>

          <p>
            <strong>{t('Why is this useful? ')}</strong>
            {t(`
             When something slows down or breaks, you won’t need to guess where the problem is hidden in your code.
             You get a precise view into the entire chain of events so you can see context that you might not get in an exception handler.
            `)}
          </p>

          <p>
            <strong>{t('Learn how to use Tracing:')}</strong>
          </p>
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
          href="https://blog.sentry.io/everyone-needs-to-know-how-to-trace/"
        >
          {t('What is Tracing, and how do I use it to debug?')}
        </ExternalLink>
      </li>
      <li>
        <ExternalLink
          openInNewTab
          href="https://docs.sentry.io/product/tracing/#how-to-use-tracing-in-sentry"
        >
          {t('Product Walkthrough: Tracing')}
        </ExternalLink>
      </li>
      <li>
        <ExternalLink
          openInNewTab
          href="https://docs.sentry.io/concepts/key-terms/tracing/distributed-tracing/#what-is-distributed-tracing"
        >
          {t('What is Distributed Tracing?')}
        </ExternalLink>
      </li>
      <li>
        <ExternalLink
          openInNewTab
          href="https://blog.sentry.io/my-errors-are-gone-with-a-trace/"
        >
          {t('How does tracing show helpful context not found in errors?')}
        </ExternalLink>
      </li>
      <li>
        <ExternalLink openInNewTab href="https://docs.sentry.io/product/explore/traces/">
          {t('Learn how to find trends with the Trace Explorer')}
        </ExternalLink>
      </li>
      <li>
        <ExternalLink
          openInNewTab
          href="https://blog.sentry.io/backend-insights-with-caches-queues-requests-queries/"
        >
          {t('Identifying backend issues with Performance Insights')}
        </ExternalLink>
      </li>
      <li>
        <ExternalLink openInNewTab href="https://docs.sentry.io/product/performance/">
          {t('How are Performance Monitoring & Traces related?')}
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

const InfoText = styled('div')``;

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
