import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {TabList, TabPanels, Tabs} from 'sentry/components/tabs';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isCustomMetric} from 'sentry/utils/metrics';
import type {MetricWidgetQueryParams} from 'sentry/utils/metrics/types';
import useOrganization from 'sentry/utils/useOrganization';
import {CodeLocations} from 'sentry/views/ddm/codeLocations';
import {useDDMContext} from 'sentry/views/ddm/context';
import {SampleTable} from 'sentry/views/ddm/sampleTable';
import {getQueryWithFocusedSeries} from 'sentry/views/ddm/utils';

enum Tab {
  SAMPLES = 'samples',
  CODE_LOCATIONS = 'codeLocations',
}

export function WidgetDetails() {
  const organization = useOrganization();
  const {selectedWidgetIndex, widgets, focusArea, setHighlightedSampleId} =
    useDDMContext();
  const [selectedTab, setSelectedTab] = useState(Tab.SAMPLES);

  const selectedWidget = widgets[selectedWidgetIndex] as
    | MetricWidgetQueryParams
    | undefined;
  const isCodeLocationsDisabled =
    selectedWidget?.mri && !isCustomMetric({mri: selectedWidget.mri});

  if (isCodeLocationsDisabled && selectedTab === Tab.CODE_LOCATIONS) {
    setSelectedTab(Tab.SAMPLES);
  }

  const queryWithFocusedSeries = useMemo(
    () => selectedWidget && getQueryWithFocusedSeries(selectedWidget),
    [selectedWidget]
  );

  const handleSampleRowHover = useCallback(
    (sampleId?: string) => {
      setHighlightedSampleId(sampleId);
    },
    [setHighlightedSampleId]
  );

  const handleTabChange = useCallback(
    (tab: Tab) => {
      if (tab === Tab.CODE_LOCATIONS) {
        trackAnalytics('ddm.code-locations', {
          organization,
        });
      }
      setSelectedTab(tab);
    },
    [organization]
  );

  return (
    <TrayWrapper>
      <Tabs value={selectedTab} onChange={handleTabChange}>
        <TabList>
          <TabList.Item key={Tab.SAMPLES}>{t('Sampled Events')}</TabList.Item>
          <TabList.Item
            textValue={t('Code Location')}
            key={Tab.CODE_LOCATIONS}
            disabled={isCodeLocationsDisabled}
          >
            <Tooltip
              title={t(
                'This metric is automatically collected by Sentry. It is not bound to a specific line of your code.'
              )}
              disabled={!isCodeLocationsDisabled}
            >
              <span style={{pointerEvents: 'all'}}>{t('Code Location')}</span>
            </Tooltip>
          </TabList.Item>
        </TabList>
        <ContentWrapper>
          <TabPanels>
            <TabPanels.Item key={Tab.SAMPLES}>
              <SampleTable
                mri={selectedWidget?.mri}
                query={queryWithFocusedSeries}
                {...focusArea?.selection?.range}
                onRowHover={handleSampleRowHover}
              />
            </TabPanels.Item>
            <TabPanels.Item key={Tab.CODE_LOCATIONS}>
              <CodeLocations mri={selectedWidget?.mri} {...focusArea?.selection?.range} />
            </TabPanels.Item>
          </TabPanels>
        </ContentWrapper>
      </Tabs>
    </TrayWrapper>
  );
}

const TrayWrapper = styled('div')`
  padding-top: ${space(4)};
  display: grid;
  grid-template-rows: auto auto 1fr;
`;

const ContentWrapper = styled('div')`
  position: relative;
  padding: ${space(2)} 0;
`;
