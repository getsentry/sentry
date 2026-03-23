import {Fragment} from 'react';
import {css} from '@emotion/react';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import {withPageFilters} from 'sentry/utils/withPageFilters';
import type {
  DashboardFilters,
  DashboardPermissions,
  Widget,
} from 'sentry/views/dashboards/types';
import {checkUserHasEditAccess} from 'sentry/views/dashboards/utils/checkUserHasEditAccess';
import {WidgetCardChartContainer} from 'sentry/views/dashboards/widgetCard/widgetCardChartContainer';
import type WidgetLegendSelectionState from 'sentry/views/dashboards/widgetLegendSelectionState';

interface TextWidgetViewerModalOptions {
  organization: Organization;
  widget: Widget;
  widgetLegendState: WidgetLegendSelectionState;
  dashboardCreator?: User;
  dashboardFilters?: DashboardFilters;
  dashboardPermissions?: DashboardPermissions;
  onEdit?: () => void;
}

interface Props extends ModalRenderProps, TextWidgetViewerModalOptions {
  organization: Organization;
  selection: PageFilters;
}

const HALF_CONTAINER_HEIGHT = 300;

function TextWidgetViewerModal(props: Props) {
  const {
    organization,
    widget,
    selection,
    Footer,
    Body,
    Header,
    closeModal,
    onEdit,
    widgetLegendState,
    dashboardPermissions,
    dashboardCreator,
  } = props;
  const currentUser = useUser();
  const {teams: userTeams} = useUserTeams();
  const hasEditAccess = checkUserHasEditAccess(
    currentUser,
    userTeams,
    organization,
    dashboardPermissions,
    dashboardCreator
  );

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h3">{widget.title}</Heading>
      </Header>
      <Body>
        <Flex maxHeight={`${HALF_CONTAINER_HEIGHT}px`} overflowY="auto">
          <WidgetCardChartContainer
            selection={selection}
            widget={widget}
            noPadding
            widgetLegendState={widgetLegendState}
          />
        </Flex>
      </Body>
      <Footer>
        <Flex flexGrow={1} align="center" justify={{sm: 'right', xs: 'center'}}>
          {onEdit && widget.id && (
            <Button
              onClick={() => {
                closeModal();
                onEdit();
                trackAnalytics('dashboards_views.widget_viewer.edit', {
                  organization,
                  widget_type: widget.widgetType ?? 'null',
                  display_type: widget.displayType,
                });
              }}
              disabled={!hasEditAccess}
              tooltipProps={{
                title:
                  !hasEditAccess && t('You do not have permission to edit this widget'),
              }}
            >
              {t('Edit Widget')}
            </Button>
          )}
        </Flex>
      </Footer>
    </Fragment>
  );
}

export const modalCss = css`
  width: 100%;
  max-width: 1200px;
`;

export const backdropCss = css`
  z-index: 9998;
`;

export default withPageFilters(TextWidgetViewerModal);
