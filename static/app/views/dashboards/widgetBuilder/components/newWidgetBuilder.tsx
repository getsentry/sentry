import {Fragment, useEffect} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import EventView from 'sentry/utils/discover/eventView';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import useKeyPress from 'sentry/utils/useKeyPress';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {
  type DashboardDetails,
  type DashboardFilters,
  DisplayType,
  type Widget,
} from 'sentry/views/dashboards/types';
import WidgetBuilderSlideout from 'sentry/views/dashboards/widgetBuilder/components/widgetBuilderSlideout';
import WidgetPreview from 'sentry/views/dashboards/widgetBuilder/components/widgetPreview';
import {
  useWidgetBuilderContext,
  WidgetBuilderProvider,
} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {DashboardsMEPProvider} from 'sentry/views/dashboards/widgetCard/dashboardsMEPContext';
import {MetricsDataSwitcher} from 'sentry/views/performance/landing/metricsDataSwitcher';

type WidgetBuilderV2Props = {
  dashboard: DashboardDetails;
  dashboardFilters: DashboardFilters;
  isOpen: boolean;
  onClose: () => void;
  onSave: ({index, widget}: {index: number; widget: Widget}) => void;
};

function WidgetBuilderV2({
  isOpen,
  onClose,
  onSave,
  dashboardFilters,
  dashboard,
}: WidgetBuilderV2Props) {
  const escapeKeyPressed = useKeyPress('Escape');

  useEffect(() => {
    if (escapeKeyPressed) {
      if (isOpen) {
        onClose?.();
      }
    }
  }, [escapeKeyPressed, isOpen, onClose]);

  return (
    <Fragment>
      {isOpen && <Backdrop style={{opacity: 0.5, pointerEvents: 'auto'}} />}
      <AnimatePresence>
        {isOpen && (
          <WidgetBuilderProvider>
            <ContainerWithoutSidebar>
              <WidgetBuilderContainer>
                <WidgetBuilderSlideout
                  isOpen={isOpen}
                  onClose={onClose}
                  onSave={onSave}
                />
                <WidgetPreviewContainer
                  dashboardFilters={dashboardFilters}
                  dashboard={dashboard}
                />
              </WidgetBuilderContainer>
            </ContainerWithoutSidebar>
          </WidgetBuilderProvider>
        )}
      </AnimatePresence>
    </Fragment>
  );
}

export default WidgetBuilderV2;

function WidgetPreviewContainer({
  dashboardFilters,
  dashboard,
}: {
  dashboard: DashboardDetails;
  dashboardFilters: DashboardFilters;
}) {
  const {state} = useWidgetBuilderContext();
  const organization = useOrganization();
  const location = useLocation();

  return (
    <DashboardsMEPProvider>
      <MetricsCardinalityProvider organization={organization} location={location}>
        <MetricsDataSwitcher
          organization={organization}
          location={location}
          hideLoadingIndicator
          eventView={EventView.fromLocation(location)}
        >
          {metricsDataSide => (
            <MEPSettingProvider
              location={location}
              forceTransactions={metricsDataSide.forceTransactionsOnly}
            >
              <SampleWidgetCard
                initial={{opacity: 0, x: '50%', y: 0}}
                animate={{opacity: 1, x: 0, y: 0}}
                exit={{opacity: 0, x: '50%', y: 0}}
                transition={{
                  type: 'spring',
                  stiffness: 500,
                  damping: 50,
                }}
                isTable={state.displayType === DisplayType.TABLE}
              >
                <WidgetPreview
                  dashboardFilters={dashboardFilters}
                  dashboard={dashboard}
                />
              </SampleWidgetCard>
            </MEPSettingProvider>
          )}
        </MetricsDataSwitcher>
      </MetricsCardinalityProvider>
    </DashboardsMEPProvider>
  );
}

const fullPageCss = css`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
`;

const Backdrop = styled('div')`
  ${fullPageCss};
  z-index: ${p => p.theme.zIndex.widgetBuilderDrawer};
  background: ${p => p.theme.black};
  will-change: opacity;
  transition: opacity 200ms;
  pointer-events: none;
  opacity: 0;
`;

const SampleWidgetCard = styled(motion.div)<{isTable: boolean}>`
  width: 30vw;
  min-width: 400px;
  height: ${p => (p.isTable ? 'auto' : '400px')};
  border: 2px dashed ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  background-color: ${p => p.theme.background};
  align-content: center;
  z-index: ${p => p.theme.zIndex.modal};
  position: relative;
  margin: auto;
`;

const ContainerWithoutSidebar = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
`;

const WidgetBuilderContainer = styled('div')`
  z-index: ${p => p.theme.zIndex.widgetBuilderDrawer};
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100vh;
  position: fixed;
  width: -webkit-fill-available; /* Chrome */
  width: -moz-available; /* Firefox */
  width: fill-available; /* others */
`;
