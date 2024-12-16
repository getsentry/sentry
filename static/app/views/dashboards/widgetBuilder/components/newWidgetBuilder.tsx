import {Fragment, useEffect, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {CustomMeasurementsProvider} from 'sentry/utils/customMeasurements/customMeasurementsProvider';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MetricsCardinalityProvider} from 'sentry/utils/performance/contexts/metricsCardinality';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import useKeyPress from 'sentry/utils/useKeyPress';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
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
import {SpanTagsProvider} from 'sentry/views/explore/contexts/spanTagsContext';
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
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const [queryConditionsValid, setQueryConditionsValid] = useState<boolean>(true);

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
            <CustomMeasurementsProvider organization={organization} selection={selection}>
              <SpanTagsProvider
                dataset={DiscoverDatasets.SPANS_EAP}
                enabled={organization.features.includes('dashboards-eap')}
              >
                <ContainerWithoutSidebar>
                  <WidgetBuilderContainer>
                    <WidgetBuilderSlideout
                      isOpen={isOpen}
                      onClose={onClose}
                      onSave={onSave}
                      onQueryConditionChange={setQueryConditionsValid}
                    />
                    <WidgetPreviewContainer
                      dashboardFilters={dashboardFilters}
                      dashboard={dashboard}
                      isWidgetInvalid={!queryConditionsValid}
                    />
                  </WidgetBuilderContainer>
                </ContainerWithoutSidebar>
              </SpanTagsProvider>
            </CustomMeasurementsProvider>
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
  isWidgetInvalid,
}: {
  dashboard: DashboardDetails;
  dashboardFilters: DashboardFilters;
  isWidgetInvalid: boolean;
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
                style={{
                  height: state.displayType === DisplayType.TABLE ? 'auto' : '400px',
                }}
              >
                <WidgetPreview
                  dashboardFilters={dashboardFilters}
                  dashboard={dashboard}
                  isWidgetInvalid={isWidgetInvalid}
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

const SampleWidgetCard = styled(motion.div)`
  width: 30vw;
  min-width: 400px;
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
