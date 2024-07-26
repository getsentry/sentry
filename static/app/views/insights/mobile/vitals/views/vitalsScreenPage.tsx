import {useState} from 'react';
import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import * as Layout from 'sentry/components/layouts/thirds';
import {TabList, Tabs} from 'sentry/components/tabs';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {useLocation} from 'sentry/utils/useLocation';
import {useModuleBreadcrumbs} from 'sentry/views/insights/common/utils/useModuleBreadcrumbs';
import {ScreenSummary as AppStartPage} from 'sentry/views/insights/mobile/appStarts/views/screenSummaryPage';
import {ScreenLoadSpans as ScreenLoadPage} from 'sentry/views/insights/mobile/screenload/views/screenLoadSpansPage';
import {ScreenSummary as UiPage} from 'sentry/views/insights/mobile/ui/views/screenSummaryPage';
import {ModuleName} from 'sentry/views/insights/types';

type Query = {
  project: string;
  transaction: string;
};

enum Tab {
  SCREEN_LOAD = 'screen_load',
  UI = 'ui',
  APP_STARTS = 'app_starts',
}

export function VitalsScreenPage() {
  const location = useLocation<Query>();

  const {transaction: transactionName} = location.query;
  const moduleName = ModuleName.MOBILE_VITALS;
  const crumbs = useModuleBreadcrumbs(moduleName);
  const [selectedTab, setSelectedTab] = useState(Tab.SCREEN_LOAD);

  const tabs = [
    {
      key: 'screen_load',
      label: t('Screen Loads'),
    },
    {
      key: 'ui',
      label: t('UI'),
    },
    {
      key: 'app_starts',
      label: t('App Starts'),
    },
  ];

  return (
    <Layout.Page>
      <PageAlertProvider>
        <Layout.Header>
          <Layout.HeaderContent style={{margin: 0}}>
            <Breadcrumbs crumbs={crumbs} />
            <Layout.Title>{transactionName}</Layout.Title>

            <Container>
              <Tabs value={selectedTab} onChange={tab => setSelectedTab(tab)}>
                <TabList hideBorder>
                  {tabs.map(tab => (
                    <TabList.Item key={tab.key}>{tab.label}</TabList.Item>
                  ))}
                </TabList>
              </Tabs>
            </Container>
          </Layout.HeaderContent>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>
            {selectedTab === Tab.UI && <UiPage showHeader={false} />}
            {selectedTab === Tab.APP_STARTS && <AppStartPage showHeader={false} />}
            {selectedTab === Tab.SCREEN_LOAD && <ScreenLoadPage showHeader={false} />}
          </Layout.Main>
        </Layout.Body>
      </PageAlertProvider>
    </Layout.Page>
  );
}

const Container = styled('div')`
  margin-top: ${space(1)};
`;

export default VitalsScreenPage;
