import {useContext, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import {SplitPanelContext} from 'sentry/components/splitPanel';
import {TabList, Tabs} from 'sentry/components/tabs';
import {IconChevron, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {parseMRI} from 'sentry/utils/metrics/mri';
import {CodeLocations} from 'sentry/views/ddm/codeLocations';
import {useDDMContext} from 'sentry/views/ddm/context';
import {TraceTable} from 'sentry/views/ddm/traceTable';

enum Tab {
  SAMPLES = 'samples',
  CODE_LOCATIONS = 'codeLocations',
}

export function TrayContent() {
  const {selectedWidgetIndex, widgets} = useDDMContext();
  const [selectedTab, setSelectedTab] = useState(Tab.CODE_LOCATIONS);
  const {isMaximized, maximiseSize, resetSize} = useContext(SplitPanelContext);
  // the tray is minimized when the main content is maximized
  const trayIsMinimized = isMaximized;
  const selectedWidget = widgets[selectedWidgetIndex];

  return (
    <TrayWrapper>
      <Header>
        <Title>
          {(selectedWidget?.mri && parseMRI(selectedWidget.mri)?.name) ||
            t('Choose a metric to display data')}
        </Title>
        <ToggleButton
          size="xs"
          isMinimized={trayIsMinimized}
          icon={<IconChevron size="xs" />}
          onClick={trayIsMinimized ? resetSize : maximiseSize}
          aria-label={trayIsMinimized ? t('show') : t('hide')}
        />
      </Header>
      <Tabs value={selectedTab} onChange={setSelectedTab}>
        <StyledTabList>
          <TabList.Item key={Tab.CODE_LOCATIONS}>{t('Code Location')}</TabList.Item>
          <TabList.Item key={Tab.SAMPLES}>{t('Samples')}</TabList.Item>
        </StyledTabList>
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
          <TraceTable
            // Force re-render when selectedWidget changes so the mocked data updates
            // TODO: remove this when we have real data
            key={selectedWidget.mri}
          />
        ) : (
          <CodeLocations mri={selectedWidget.mri} />
        )}
      </ContentWrapper>
    </TrayWrapper>
  );
}

const TrayWrapper = styled('div')`
  height: 100%;
  background-color: ${p => p.theme.background};
  z-index: ${p => p.theme.zIndex.sidebar};
  display: grid;
  grid-template-rows: auto auto 1fr;
`;

const Header = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 0 ${space(4)};
  height: 32px;
  background-color: ${p => p.theme.backgroundSecondary};
`;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  font-weight: bold;
`;

const ToggleButton = styled(Button)<{isMinimized}>`
  & svg {
    transform: rotate(${p => (p.isMinimized ? '0deg' : '180deg')});
  }
`;

const StyledTabList = styled(TabList)`
  padding: 0 ${space(4)};
  background-color: ${p => p.theme.backgroundSecondary};
`;

const ContentWrapper = styled('div')`
  position: relative;
  padding: ${space(2)} ${space(4)};
  overflow: auto;
`;

const CenterContent = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
`;
