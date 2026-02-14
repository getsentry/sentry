import {Fragment, useEffect, useRef, type ComponentType} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';
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
 * Wrapper that gives each guide tab its own ref for innerHTML-based
 * markdown copying. Without this, a shared ref would always point to
 * the last rendered tab panel instead of the active one.
 */
function GuideWithCopy({Guide}: {Guide: ComponentType}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // TODO: Migrate crons guides to the content block system so we can use
  // structured stepsToMarkdown() instead of innerHTML scraping. The innerHTML
  // approach may include rendered UI chrome and won't substitute auth tokens.
  const getMarkdown = () => {
    if (!containerRef.current) {
      return '';
    }
    try {
      return simpleHtmlToMarkdown(containerRef.current.innerHTML);
    } catch {
      return '';
    }
  };

  return (
    <GuideContainer>
      <CopySetupInstructionsGate>
        <Container paddingBottom="md">
          <CopyMarkdownButton getMarkdown={getMarkdown} source="crons_upsert_guide" />
        </Container>
      </CopySetupInstructionsGate>
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

          <Tabs onChange={key => setPlatformGuide(platformKey, key)} value={guideKey}>
            <TabList>
              {[
                ...platform.guides.map(({key, title}) => (
                  <TabList.Item key={key}>{title}</TabList.Item>
                )),
                <TabList.Item key="manual">{t('Manual')}</TabList.Item>,
              ]}
            </TabList>
            <TabPanels>
              {[
                ...platform.guides.map(({key, Guide}) => (
                  <TabPanels.Item key={key}>
                    <GuideWithCopy Guide={Guide} />
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
