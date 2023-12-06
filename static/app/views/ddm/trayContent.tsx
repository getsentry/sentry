import styled from '@emotion/styled';

import EmptyMessage from 'sentry/components/emptyMessage';
import {TabList, Tabs} from 'sentry/components/tabs';
import {IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useDDMContext} from 'sentry/views/ddm/context';
import {TraceTable} from 'sentry/views/ddm/traceTable';

export function TrayContent() {
  const {selectedWidgetIndex, widgets} = useDDMContext();
  const selectedWidget = widgets[selectedWidgetIndex];

  return (
    <TrayWrapper>
      <Header>
        <Title>{selectedWidget?.mri || t('Choose a metric to display data')}</Title>
        {/* TODO(aknaus): Add collapse toggle */}
      </Header>
      <Tabs defaultValue="samples">
        <StyledTabList>
          <TabList.Item key="samples">{t('Samples')}</TabList.Item>
          <TabList.Item key="codeLocations">{t('Code Location')}</TabList.Item>
        </StyledTabList>
      </Tabs>
      <ContentWrapper>
        {!selectedWidget.mri ? (
          <CenterContent>
            <EmptyMessage
              style={{margin: 'auto'}}
              icon={<IconSearch size="xxl" />}
              title={t('Nothing to show!')}
              description={t('Choose a metric to display data.')}
            />
          </CenterContent>
        ) : (
          <TraceTable
            // Force re-render when selectedWidget changes so the mocked data updates
            // TODO: remove this when we have real data
            key={selectedWidget.mri}
          />
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

const StyledTabList = styled(TabList)`
  padding: 0 ${space(4)};
  background-color: ${p => p.theme.backgroundSecondary};
`;

const ContentWrapper = styled('div')`
  padding: ${space(0)} ${space(4)};
  overflow: auto;
`;

const CenterContent = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
`;
