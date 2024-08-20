import {Fragment} from 'react';
import {createPortal} from 'react-dom';
import type {Theme} from '@emotion/react';
import {css, useTheme} from '@emotion/react';

import {Button} from 'sentry/components/button';
import Card from 'sentry/components/card';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {
  IconChevron,
  IconClose,
  IconDocs,
  IconFire,
  IconLightning,
  IconMegaphone,
  IconPlay,
  IconStack,
  IconTag,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {SectionKey, useEventDetails} from 'sentry/views/issueDetails/streamline/context';
import {sectionLabels} from 'sentry/views/issueDetails/streamline/eventNavigation';

const icons = {
  [SectionKey.HIGHLIGHTS]: <IconLightning />,
  [SectionKey.STACKTRACE]: <IconStack />,
  [SectionKey.EXCEPTION]: <IconFire />,
  [SectionKey.BREADCRUMBS]: <IconChevron direction="right" />,
  [SectionKey.TAGS]: <IconTag />,
  [SectionKey.CONTEXTS]: <IconDocs />,
  [SectionKey.USER_FEEDBACK]: <IconMegaphone />,
  [SectionKey.REPLAY]: <IconPlay />,
};

interface OnboardingGuide {
  activeSection: SectionKey;
  dismissed: boolean;
}

export function OnboardingWidget() {
  const theme = useTheme();
  const {sectionData} = useEventDetails();
  const [onboardingGuideConfig, setOnboardingGuideConfig] =
    useLocalStorageState<OnboardingGuide>('onboarding-guide-config', {
      activeSection: SectionKey.HIGHLIGHTS,
      dismissed: false,
    });

  if (onboardingGuideConfig.dismissed) {
    return null;
  }

  const eventSectionConfigs = Object.values(sectionData ?? {}).filter(
    config => sectionLabels[config.key]
  );

  return (
    <Fragment>
      {createPortal(
        <Fragment>
          <div css={backdropCss} />
          <div css={[fixedContainerBaseCss, fixedContainerRightEdgeCss]}>
            <div css={contentCss(theme)}>
              <div css={headerCss(theme)}>
                <h4>{t('Test your Sentry SDK Setup')}</h4>
                <Button
                  css={dismissButtonCss(theme)}
                  aria-label={t('Dismiss onboarding guide')}
                  icon={<IconClose color="white" />}
                  onClick={() =>
                    setOnboardingGuideConfig({...onboardingGuideConfig, dismissed: true})
                  }
                  size="sm"
                  borderless
                />
              </div>
              <hr />
              <div css={bodyCss(theme)}>
                {eventSectionConfigs.map(config => (
                  <Card
                    key={config.key}
                    onClick={() => {
                      setOnboardingGuideConfig({
                        ...onboardingGuideConfig,
                        activeSection: config.key,
                      });
                      document
                        .getElementById(config.key)
                        ?.scrollIntoView({block: 'start', behavior: 'smooth'});
                    }}
                    css={cardCss(
                      theme,
                      config.key === onboardingGuideConfig.activeSection
                    )}
                  >
                    <InteractionStateLayer />
                    {icons[sectionLabels[config.key]]}
                    {sectionLabels[config.key]}
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </Fragment>,
        document.body
      )}
    </Fragment>
  );
}

const dismissButtonCss = (theme: Theme) => css`
  &:hover {
    border-color: ${theme.white};
  }
`;

const contentCss = (theme: Theme) => css`
  min-width: 400px;
  background: linear-gradient(41deg, rgba(58, 46, 93, 1) 61%, rgba(136, 81, 145, 1) 100%);
  border-top-left-radius: ${theme.borderRadius};
  border-bottom-left-radius: ${theme.borderRadius};
  border: 1px solid ${theme.border};
  overflow: hidden;
  hr {
    border-color: ${theme.border};
    margin: 0;
  }
`;

const headerCss = (theme: Theme) => css`
  padding: ${space(1.5)} ${space(2)};
  display: grid;
  grid-template-columns: 1fr max-content;
  gap: ${space(1)};
  color: ${theme.white};
  align-items: center;
  h4 {
    margin-bottom: 0;
  }
`;

const bodyCss = (theme: Theme) => css`
  padding: ${space(1.5)} ${space(2)};
  display: grid;
  align-items: center;
  background: ${theme.background};
`;

const cardCss = (theme: Theme, selected: boolean) => css`
  padding: ${space(2)} ${space(3)};
  cursor: pointer;
  font-size: ${theme.fontSizeLarge};
  display: grid;
  grid-template-columns: max-content 1fr;
  align-items: center;
  gap: ${space(1)};
  ${selected &&
  css`
    color: ${theme.purple400};
    font-weight: ${theme.fontWeightBold};
    background-color: ${theme.purple100};
  `}
`;

const fixedContainerBaseCss = css`
  display: flex;
  gap: ${space(1.5)};
  inset: 0;
  pointer-events: none;
  position: fixed;
  z-index: 300000;

  & > * {
    pointer-events: all;
  }
`;

const fixedContainerRightEdgeCss = css`
  flex-direction: row-reverse;
  justify-content: flex-start;
  place-items: center;
`;

const backdropCss = (theme: Theme) => css`
  background: ${theme.black};
  will-change: opacity;
  transition: opacity 200ms;
  opacity: 0.5;
  pointer-events: auto;
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 200000;
`;
