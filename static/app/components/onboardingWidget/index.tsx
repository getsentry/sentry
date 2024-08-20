import {Fragment, useCallback, useEffect} from 'react';
import {createPortal} from 'react-dom';
import type {Theme} from '@emotion/react';
import {css, useTheme} from '@emotion/react';

import {Button, LinkButton} from 'sentry/components/button';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {CHART_PALETTE} from 'sentry/constants/chartPalette';
import {IconCircleFill, IconClose, IconIssues, IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {SectionKey, useEventDetails} from 'sentry/views/issueDetails/streamline/context';
import {sectionLabels} from 'sentry/views/issueDetails/streamline/eventNavigation';

interface OnboardingGuide {
  activeSection: SectionKey;
  dismissed: boolean;
}

const sections = {
  [SectionKey.HIGHLIGHTS]: {
    title: t('Event Highlights'),
    description: t(
      'This is short introduction to explain the value of the selected section'
    ),
    color: CHART_PALETTE[0],
  },
  [SectionKey.STACKTRACE]: {
    title: t('Stack Trace'),
    description: t(
      'This is short introduction to explain the value of the selected section'
    ),
    color: CHART_PALETTE[5][1],
  },
  [SectionKey.EXCEPTION]: {
    title: t('Stack Trace'),
    description: t(
      'This is short introduction to explain the value of the selected section'
    ),
    color: CHART_PALETTE[5][1],
  },
  [SectionKey.REPLAY]: {
    title: t('Session Replay'),
    description: t(
      'This is short introduction to explain the value of the selected section'
    ),
    color: CHART_PALETTE[5][2],
  },
};

export function OnboardingWidget() {
  const theme = useTheme();
  const {sectionData} = useEventDetails();
  const [onboardingGuideConfig, setOnboardingGuideConfig] =
    useLocalStorageState<OnboardingGuide>('onboarding-guide-config', {
      activeSection: SectionKey.HIGHLIGHTS,
      dismissed: false,
    });

  useEffect(() => {
    const sectionNode = document.getElementById(onboardingGuideConfig.activeSection);
    if (!sectionNode) {
      return;
    }

    Object.assign(sectionNode.style, {
      position: 'relative',
      zIndex: '300000',
      background: theme.background,
      overflow: 'hidden',
      border: `3px solid ${sections[onboardingGuideConfig.activeSection].color}`,
      borderRadius: theme.borderRadius,
    });
    sectionNode.scrollIntoView({block: 'start', behavior: 'smooth'});
  }, [onboardingGuideConfig.activeSection, theme]);

  const handleSectionClick = useCallback(
    (section: SectionKey) => {
      const currentSectionNode = document.getElementById(
        onboardingGuideConfig.activeSection
      );
      if (currentSectionNode) {
        Object.assign(currentSectionNode.style, {
          position: 'static',
          zIndex: 'auto',
          background: 'transparent',
          overflow: 'visible',
          border: 'none',
          borderRadius: 0,
        });
      }

      setOnboardingGuideConfig({
        ...onboardingGuideConfig,
        activeSection: section,
      });
    },
    [onboardingGuideConfig, setOnboardingGuideConfig]
  );

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
                <IconIssues size="sm" />
                {t('Issue Details')}
                <Button
                  aria-label={t('Dismiss onboarding guide')}
                  icon={<IconClose />}
                  onClick={() =>
                    setOnboardingGuideConfig({...onboardingGuideConfig, dismissed: true})
                  }
                  size="sm"
                  borderless
                />
              </div>
              {eventSectionConfigs.map(config => {
                if (!sections[config.key]) {
                  return null;
                }
                return (
                  <div key={config.key} css={itemCss}>
                    <InteractionStateLayer
                      isPressed={config.key === onboardingGuideConfig.activeSection}
                    />
                    <div
                      css={sectionCssContent}
                      onClick={() => handleSectionClick(config.key)}
                    >
                      <IconCircleFill color={sections[config.key].color} />
                      {sections[config.key].title}
                    </div>
                  </div>
                );
              })}
              <LinkButton to="/" icon={<IconSpan />} priority="link" css={itemCss}>
                {t('See this issue in the trace view ')}
              </LinkButton>
            </div>
          </div>
        </Fragment>,
        document.body
      )}
    </Fragment>
  );
}

const contentCss = (theme: Theme) => css`
  min-width: 320px;
  border-radius: ${theme.borderRadius};
  border: 1px solid ${theme.border};
  background: ${theme.background};
  right: ${space(2)};
  padding: ${space(0.5)};
  font-weight: 600;
`;

const headerCss = (theme: Theme) => css`
  padding-left: ${space(1.5)};
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  gap: ${space(1)};
  color: ${theme.gray300};
  align-items: center;
  h4 {
    margin-bottom: 0;
  }
`;

const itemCss = css`
  position: relative;
  cursor: pointer;
  padding: ${space(1)} ${space(1.5)};
`;

const sectionCssContent = css`
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${space(1)};
  align-items: center;
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
  right: ${space(2)};
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
