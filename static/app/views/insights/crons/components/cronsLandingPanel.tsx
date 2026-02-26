import {Fragment, useEffect, useRef, type ComponentType} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {TabList, TabPanels, Tabs} from '@sentry/scraps/tabs';

import HookOrDefault from 'sentry/components/hookOrDefault';
import {
  CopyMarkdownButton,
  CopySetupInstructionsGate,
} from 'sentry/components/onboarding/gettingStartedDoc/onboardingCopyMarkdownButton';
import {simpleHtmlToMarkdown} from 'sentry/components/onboarding/utils/stepsToMarkdown';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import MonitorCreateForm from 'sentry/views/insights/crons/components/monitorCreateForm';

import {PlatformPickerPanel} from './platformPickerPanel';
import {useCronsUpsertGuideState} from './useCronsUpsertGuideState';

/**
 * Wrapper for guide tab content with a ref for innerHTML-based markdown
 * copying. The ref is passed from the parent so the copy button can live
 * outside (next to the tab list) while still reading the active guide's HTML.
 */
function GuideContent({
  Guide,
  containerRef,
}: {
  Guide: ComponentType;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <GuideContainer>
      <div ref={containerRef}>
        <Guide />
      </div>
    </GuideContainer>
  );
}

export function CronsLandingPanel() {
  const organization = useOrganization();

  const {platformKey, guideKey, platform, setPlatformGuide} = useCronsUpsertGuideState();
  const guideVisibile = platform && guideKey;
  const guideContainerRef = useRef<HTMLDivElement>(null);

  // TODO: Migrate crons guides to the content block system so we can use
  // structured stepsToMarkdown() instead of innerHTML scraping. The innerHTML
  // approach may include rendered UI chrome and won't substitute auth tokens.
  const getGuideMarkdown = () => {
    if (!guideContainerRef.current) {
      return '';
    }
    try {
      return simpleHtmlToMarkdown(guideContainerRef.current.innerHTML);
    } catch {
      return '';
    }
  };

  const OnboardingPanelHook = HookOrDefault({
    hookName: 'component:crons-onboarding-panel',
    defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
  });

  useEffect(() => {
    if (!guideVisibile) {
      return;
    }

    trackAnalytics('landing_page.platform_guide.viewed', {
      organization,
      platform: platformKey ?? '',
      guide: guideKey,
    });
  }, [organization, platformKey, guideKey, guideVisibile]);

  if (!guideVisibile) {
    return (
      <OnboardingPanelHook>
        <PlatformPickerPanel onSelect={setPlatformGuide} />
      </OnboardingPanelHook>
    );
  }

  return (
    <OnboardingPanelHook>
      <Panel>
        <BackButton
          icon={<IconChevron direction="left" />}
          onClick={() => setPlatformGuide(null)}
          priority="transparent"
        >
          {t('Back to Platforms')}
        </BackButton>
        <PanelBody withPadding>
          <h3>{t('Get Started with %s', platform.label)}</h3>

          <Tabs
            disableOverflow
            onChange={key => setPlatformGuide(platformKey, key)}
            value={guideKey}
          >
            <Flex justify="between" align="center">
              <TabList>
                {[
                  ...platform.guides.map(({key, title}) => (
                    <TabList.Item key={key}>{title}</TabList.Item>
                  )),
                  <TabList.Item key="manual">{t('Manual')}</TabList.Item>,
                ]}
              </TabList>
              {guideKey !== 'manual' && (
                <CopySetupInstructionsGate>
                  <CopyMarkdownButton
                    borderless
                    getMarkdown={getGuideMarkdown}
                    source="crons_upsert_guide"
                  />
                </CopySetupInstructionsGate>
              )}
            </Flex>
            <TabPanels>
              {[
                ...platform.guides.map(({key, Guide}) => (
                  <TabPanels.Item key={key}>
                    <GuideContent Guide={Guide} containerRef={guideContainerRef} />
                  </TabPanels.Item>
                )),
                <TabPanels.Item key="manual">
                  <GuideContainer>
                    <MonitorCreateForm />
                  </GuideContainer>
                </TabPanels.Item>,
              ]}
            </TabPanels>
          </Tabs>
        </PanelBody>
      </Panel>
    </OnboardingPanelHook>
  );
}

const BackButton = styled(Button)`
  font-weight: ${p => p.theme.font.weight.sans.regular};
  color: ${p => p.theme.tokens.content.secondary};
  margin: ${space(1)} 0 0 ${space(1)};
  padding-left: ${space(0.5)};
  padding-right: ${space(0.5)};
`;

const GuideContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  padding-top: ${space(2)};
`;
