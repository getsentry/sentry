import {Fragment, memo, useMemo} from 'react';
import {css} from '@emotion/react';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import withPageFilters from 'sentry/utils/withPageFilters';
import type {
  DashboardFilters,
  DashboardPermissions,
  Widget,
} from 'sentry/views/dashboards/types';
import {checkUserHasEditAccess} from 'sentry/views/dashboards/utils/checkUserHasEditAccess';
import {WidgetCardChartContainer} from 'sentry/views/dashboards/widgetCard/widgetCardChartContainer';
import type WidgetLegendSelectionState from 'sentry/views/dashboards/widgetLegendSelectionState';

import {WidgetViewerQueryField} from './widgetViewerModal/utils';

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

const shouldWidgetCardChartMemo = (prevProps: any, props: any) => {
  return props.selection === prevProps.selection;
};

// WidgetCardChartContainer and WidgetCardChart rerenders if selection was changed.
// This is required because we want to prevent ECharts interactions from causing
// unnecessary rerenders which can break legends and zoom functionality.
const MemoizedWidgetCardChartContainer = memo(
  WidgetCardChartContainer,
  shouldWidgetCardChartMemo
);

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
  const location = useLocation();

  // Get widget zoom from location
  // We use the start and end query params for just the initial state
  const start = decodeScalar(location.query[WidgetViewerQueryField.START]);
  const end = decodeScalar(location.query[WidgetViewerQueryField.END]);

  const locationPageFilter = useMemo(
    () =>
      start && end
        ? {
            ...selection,
            datetime: {start, end, period: null, utc: null},
          }
        : selection,
    [start, end, selection]
  );

  const api = useApi();

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
        <Stack gap="md">
          <Flex align="center" gap="sm">
            <Heading as="h3">{widget.title}</Heading>
          </Flex>
        </Stack>
      </Header>
      <Body>
        <Fragment>
          <Flex
            display="flex"
            direction="column"
            height={`${HALF_CONTAINER_HEIGHT}px`}
            position="relative"
            paddingBottom="2xl"
          >
            <MemoizedWidgetCardChartContainer
              api={api}
              selection={locationPageFilter}
              widget={widget}
              noPadding
              widgetLegendState={widgetLegendState}
            />
          </Flex>
        </Fragment>
      </Body>
      <Footer>
        <Flex
          display="flex"
          flexGrow={1}
          direction={{sm: 'row', xs: 'column'}}
          align="center"
          justify="right"
        >
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
