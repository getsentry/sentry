import * as React from 'react';
import styled from '@emotion/styled';

import {
  openAddDashboardWidgetModal,
  openDashboardWidgetLibraryModal,
} from 'sentry/actionCreators/modal';
import FeatureBadge from 'sentry/components/featureBadge';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {
  DashboardDetails,
  DashboardWidgetSource,
  Widget,
} from 'sentry/views/dashboardsV2/types';
import {WidgetTemplate} from 'sentry/views/dashboardsV2/widgetLibrary/data';

import Button from '../../button';
import ButtonBar from '../../buttonBar';

import {setWidgetLibraryVisit, shouldShowNewBadge} from './utils';

export enum TAB {
  Library = 'library',
  Custom = 'custom',
}

type Props = {
  activeTab: TAB;
  dashboard: DashboardDetails;
  organization: Organization;
  customWidget?: Widget;
  onAddWidget?: (widgets: Widget[]) => void;
  selectedWidgets?: WidgetTemplate[];
};

export function TabsButtonBar({
  activeTab,
  organization,
  dashboard,
  selectedWidgets,
  customWidget,
  onAddWidget,
}: Props) {
  return (
    <StyledButtonBar active={activeTab}>
      <CustomButton
        barId={TAB.Custom}
        onClick={() => {
          if (activeTab === TAB.Custom) {
            return;
          }
          trackAdvancedAnalyticsEvent('dashboards_views.widget_library.switch_tab', {
            organization,
            to: TAB.Custom,
          });
          openAddDashboardWidgetModal({
            organization,
            dashboard,
            selectedWidgets,
            widget: customWidget,
            source: DashboardWidgetSource.LIBRARY,
            onAddLibraryWidget: onAddWidget,
          });
        }}
      >
        {t('Custom Widget')}
      </CustomButton>
      <LibraryButton
        barId={TAB.Library}
        data-test-id="library-tab"
        onClick={() => {
          if (activeTab === TAB.Library) {
            return;
          }
          trackAdvancedAnalyticsEvent('dashboards_views.widget_library.switch_tab', {
            organization,
            to: TAB.Library,
          });
          setWidgetLibraryVisit();
          if (defined(onAddWidget)) {
            openDashboardWidgetLibraryModal({
              organization,
              dashboard,
              customWidget,
              initialSelectedWidgets: selectedWidgets,
              onAddWidget,
            });
          }
        }}
      >
        {t('Widget Library')}
        {shouldShowNewBadge() && <FeatureBadge type="new" />}
      </LibraryButton>
    </StyledButtonBar>
  );
}

const StyledButtonBar = styled(ButtonBar)`
  display: inline-flex;
  margin-bottom: ${space(2)};
`;

const LibraryButton = styled(Button)`
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
`;

const CustomButton = styled(Button)`
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  line-height: 17px;
`;
