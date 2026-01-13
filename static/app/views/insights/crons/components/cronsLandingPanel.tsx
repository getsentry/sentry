import {Fragment, useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import {CheckInTimeline} from 'sentry/components/checkInTimeline/checkInTimeline';
import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import {getConfigFromTimeRange} from 'sentry/components/checkInTimeline/utils/getConfigFromTimeRange';
import {Button} from 'sentry/components/core/button';
import {TabList, TabPanels, Tabs} from 'sentry/components/core/tabs';
import HookOrDefault from 'sentry/components/hookOrDefault';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';
import {useMonitorsScheduleSampleBuckets} from 'sentry/views/detectors/hooks/useMonitorsScheduleSampleBuckets';
import {useMonitorsScheduleSampleWindow} from 'sentry/views/detectors/hooks/useMonitorsScheduleSampleWindow';
import MonitorCreateForm from 'sentry/views/insights/crons/components/monitorCreateForm';
import {
  checkInStatusPrecedent,
  statusToText,
  tickStyle,
} from 'sentry/views/insights/crons/utils';

import {PlatformPickerPanel} from './platformPickerPanel';
import {useCronsUpsertGuideState} from './useCronsUpsertGuideState';

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
      <Preview />
      <Panel>
        <BackButton
          icon={<IconChevron direction="left" />}
          onClick={() => setPlatformGuide(null)}
          borderless
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
                    <GuideContainer>
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

function Preview() {
  const {data: sampleWindowData} = useMonitorsScheduleSampleWindow();

  const elementRef = useRef<HTMLDivElement>(null);
  const {width: timelineWidth} = useDimensions<HTMLDivElement>({elementRef});

  const timeWindowConfig = sampleWindowData
    ? getConfigFromTimeRange(
        new Date(sampleWindowData.start * 1000),
        new Date(sampleWindowData.end * 1000),
        timelineWidth,
        'UTC'
      )
    : undefined;
  const {data: sampleBucketsData} = useMonitorsScheduleSampleBuckets({
    start: timeWindowConfig?.start.getTime()
      ? timeWindowConfig.start.getTime() / 1000
      : undefined,
    endTs: timeWindowConfig?.end.getTime()
      ? timeWindowConfig.end.getTime() / 1000
      : undefined,
    interval: timeWindowConfig?.rollupConfig.interval ?? undefined,
  });

  console.log(timeWindowConfig);

  return (
    <Container>
      <TimelineWidthTracker ref={elementRef} />
      {timeWindowConfig && sampleBucketsData && (
        <Fragment>
          <GridLineOverlay showCursor timeWindowConfig={timeWindowConfig} />
          <GridLineLabels timeWindowConfig={timeWindowConfig} />
          <TimeLineContainer>
            <CheckInTimeline
              bucketedData={sampleBucketsData}
              timeWindowConfig={timeWindowConfig}
              statusLabel={statusToText}
              statusStyle={tickStyle}
              statusPrecedent={checkInStatusPrecedent}
            />
          </TimeLineContainer>
        </Fragment>
      )}
    </Container>
  );
}

const TimelineWidthTracker = styled('div')`
  position: absolute;
  width: 100%;
  height: 100%;
`;

const TimeLineContainer = styled('div')`
  position: absolute;
  top: 46px;
  width: calc(100%);
`;

const Container = styled('div')`
  position: relative;
  width: 100%;
  height: 100px;
  background-color: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  margin-bottom: ${p => p.theme.space.lg};
`;

const BackButton = styled(Button)`
  font-weight: ${p => p.theme.fontWeight.normal};
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
