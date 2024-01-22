import {useState} from 'react';
import styled from '@emotion/styled';

import {TabList, TabPanels, Tabs} from 'sentry/components/tabs';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {isCustomMetric, MetricWidgetQueryParams} from 'sentry/utils/metrics';
import {CodeLocations} from 'sentry/views/ddm/codeLocations';
import {useDDMContext} from 'sentry/views/ddm/context';
import {SampleTable} from 'sentry/views/ddm/sampleTable';

enum Tab {
  SAMPLES = 'samples',
  CODE_LOCATIONS = 'codeLocations',
}

const constructQueryString = (queryObject: Record<string, string>) => {
  return Object.entries(queryObject)
    .map(([key, value]) => `${key}:"${value}"`)
    .join(' ');
};

export function WidgetDetails() {
  const {selectedWidgetIndex, widgets, focusArea} = useDDMContext();
  const [selectedTab, setSelectedTab] = useState(Tab.SAMPLES);
  // the tray is minimized when the main content is maximized
  const selectedWidget = widgets[selectedWidgetIndex] as
    | MetricWidgetQueryParams
    | undefined;
  const isCodeLocationsDisabled =
    selectedWidget?.mri && !isCustomMetric({mri: selectedWidget.mri});

  if (isCodeLocationsDisabled && selectedTab === Tab.CODE_LOCATIONS) {
    setSelectedTab(Tab.SAMPLES);
  }

  return (
    <TrayWrapper>
      <Tabs value={selectedTab} onChange={setSelectedTab}>
        <TabList>
          <TabList.Item key={Tab.SAMPLES}>{t('Samples')}</TabList.Item>
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
                query={
                  selectedWidget?.focusedSeries?.groupBy
                    ? `${selectedWidget.query} ${constructQueryString(
                        selectedWidget.focusedSeries.groupBy
                      )}`.trim()
                    : selectedWidget?.query
                }
                {...focusArea?.range}
              />
            </TabPanels.Item>
            <TabPanels.Item key={Tab.CODE_LOCATIONS}>
              <CodeLocations mri={selectedWidget?.mri} {...focusArea?.range} />
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
