import {Fragment, useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {TabList, TabPanels, Tabs} from '@sentry/scraps/tabs';
import {Tooltip} from '@sentry/scraps/tooltip';

import HookOrDefault from 'sentry/components/hookOrDefault';
import {simpleHtmlToMarkdown} from 'sentry/components/onboarding/gettingStartedDoc/utils/stepsToMarkdown';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {IconChevron, IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {copyToClipboard} from 'sentry/utils/useCopyToClipboard';
import useOrganization from 'sentry/utils/useOrganization';
import MonitorCreateForm from 'sentry/views/insights/crons/components/monitorCreateForm';

import {PlatformPickerPanel} from './platformPickerPanel';
import {useCronsUpsertGuideState} from './useCronsUpsertGuideState';

export function CronsLandingPanel() {
  const organization = useOrganization();
  const guideContainerRef = useRef<HTMLDivElement>(null);

  const {platformKey, guideKey, platform, setPlatformGuide} = useCronsUpsertGuideState();
  const guideVisibile = platform && guideKey;

  const activeGuide = platform?.guides.find(g => g.key === guideKey);

  const getGuideMarkdown = () => {
    if (!guideContainerRef.current) {
      return '';
    }
    try {
      const html = guideContainerRef.current.innerHTML;
      return simpleHtmlToMarkdown(html);
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
          <Flex align="center" justify="between">
            <h3>{t('Get Started with %s', platform.label)}</h3>
            {activeGuide && (
              <Tooltip title={t('Let an LLM do all the work instead')}>
                <Button
                  size="xs"
                  icon={<IconCopy />}
                  onClick={() => {
                    trackAnalytics('onboarding.copy_instructions', {
                      organization,
                      format: 'markdown',
                      source: 'crons_upsert_guide',
                    });
                    copyToClipboard(getGuideMarkdown());
                  }}
                >
                  {t('Copy as Markdown')}
                </Button>
              </Tooltip>
            )}
          </Flex>
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
                    <GuideContainer ref={guideContainerRef}>
                      <Guide />
                    </GuideContainer>
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
