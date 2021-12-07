import * as React from 'react';
import styled from '@emotion/styled';

import {
  openAddDashboardWidgetModal,
  openDashboardWidgetLibraryModal,
} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import {
  DashboardDetails,
  DashboardWidgetSource,
  Widget,
} from 'sentry/views/dashboardsV2/types';
import {WidgetTemplate} from 'sentry/views/dashboardsV2/widgetLibrary/data';

import Button from '../../button';
import ButtonBar from '../../buttonBar';

export enum TAB {
  Library = 'library',
  Custom = 'custom',
}

type Props = {
  activeTab: TAB;
  organization: Organization;
  dashboard: DashboardDetails;
  selectedWidgets?: WidgetTemplate[];
  customWidget?: Widget;
  onAddWidget?: (widgets: Widget[]) => void;
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
      <LibraryButton
        barId={TAB.Library}
        onClick={() => {
          if (activeTab === TAB.Library) {
            return;
          }
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
      </LibraryButton>
      <CustomButton
        barId={TAB.Custom}
        onClick={() => {
          if (activeTab === TAB.Custom) {
            return;
          }
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
    </StyledButtonBar>
  );
}

const StyledButtonBar = styled(ButtonBar)`
  display: inline;
  margin-bottom: ${space(2)};
`;

const LibraryButton = styled(Button)`
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
`;

const CustomButton = styled(Button)`
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
`;
