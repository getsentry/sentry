import {useState} from 'react';
import styled from '@emotion/styled';

import EmptyMessage from 'sentry/components/emptyMessage';
import {TabList, Tabs} from 'sentry/components/tabs';
import {Tooltip} from 'sentry/components/tooltip';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {isCustomMetric, MetricWidgetQueryParams} from 'sentry/utils/metrics';
import {CodeLocations} from 'sentry/views/ddm/codeLocations';
import {useDDMContext} from 'sentry/views/ddm/context';
import {TraceTable} from 'sentry/views/ddm/samplesTable';

enum Tab {
  SAMPLES = 'samples',
  CODE_LOCATIONS = 'codeLocations',
}

export function WidgetDetails() {
  const {selectedWidgetIndex, widgets, focusArea} = useDDMContext();
  const [selectedTab, setSelectedTab] = useState(Tab.CODE_LOCATIONS);
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
          <TabList.Item key={Tab.SAMPLES}>{t('Samples')}</TabList.Item>
        </TabList>
      </Tabs>
      <ContentWrapper>
        {!selectedWidget?.mri ? (
          <CenterContent>
            <EmptyMessage
              style={{margin: 'auto'}}
              icon={<IconSearch size="xxl" />}
              title={t('Nothing to show!')}
              description={t('Choose a metric to display data.')}
            />
          </CenterContent>
        ) : selectedTab === Tab.SAMPLES ? (
          <TraceTable mri={selectedWidget.mri} {...focusArea?.range} />
        ) : (
          <CodeLocations mri={selectedWidget.mri} {...focusArea?.range} />
        )}
      </ContentWrapper>
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
  overflow: auto;
`;

const CenterContent = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
`;
