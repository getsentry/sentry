import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type RefCallback,
} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {Flex} from '@sentry/scraps/layout';
import {SlideOverPanel} from '@sentry/scraps/slideOverPanel';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {openConfirmModal} from 'sentry/components/confirm';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ExternalLink, Link} from 'sentry/components/core/link';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Placeholder from 'sentry/components/placeholder';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {WidgetBuilderVersion} from 'sentry/utils/analytics/dashboardsAnalyticsEvents';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import {useValidateWidgetQuery} from 'sentry/views/dashboards/hooks/useValidateWidget';
import {
  DisplayType,
  WidgetType,
  type DashboardDetails,
  type DashboardFilters,
  type Widget,
} from 'sentry/views/dashboards/types';
import {isChartDisplayType} from 'sentry/views/dashboards/utils';
import {animationTransitionSettings} from 'sentry/views/dashboards/widgetBuilder/components/common/animationSettings';
import WidgetBuilderDatasetSelector from 'sentry/views/dashboards/widgetBuilder/components/datasetSelector';
import WidgetBuilderFilterBar from 'sentry/views/dashboards/widgetBuilder/components/filtersBar';
import WidgetBuilderGroupBySelector from 'sentry/views/dashboards/widgetBuilder/components/groupBySelector';
import WidgetBuilderNameAndDescription from 'sentry/views/dashboards/widgetBuilder/components/nameAndDescFields';
import {
  WidgetPreviewContainer,
  type ThresholdMetaState,
} from 'sentry/views/dashboards/widgetBuilder/components/newWidgetBuilder';
import WidgetBuilderQueryFilterBuilder from 'sentry/views/dashboards/widgetBuilder/components/queryFilterBuilder';
import SaveButtonGroup from 'sentry/views/dashboards/widgetBuilder/components/saveButtonGroup';
import WidgetBuilderSortBySelector from 'sentry/views/dashboards/widgetBuilder/components/sortBySelector';
import ThresholdsSection from 'sentry/views/dashboards/widgetBuilder/components/thresholds';
import WidgetBuilderTypeSelector from 'sentry/views/dashboards/widgetBuilder/components/typeSelector';
import Visualize from 'sentry/views/dashboards/widgetBuilder/components/visualize';
import WidgetTemplatesList from 'sentry/views/dashboards/widgetBuilder/components/widgetTemplatesList';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {useCacheBuilderState} from 'sentry/views/dashboards/widgetBuilder/hooks/useCacheBuilderState';
import useDashboardWidgetSource from 'sentry/views/dashboards/widgetBuilder/hooks/useDashboardWidgetSource';
import {useDisableTransactionWidget} from 'sentry/views/dashboards/widgetBuilder/hooks/useDisableTransactionWidget';
import useIsEditingWidget from 'sentry/views/dashboards/widgetBuilder/hooks/useIsEditingWidget';
import {useSegmentSpanWidgetState} from 'sentry/views/dashboards/widgetBuilder/hooks/useSegmentSpanWidgetState';
import {convertBuilderStateToWidget} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';
import {convertWidgetToBuilderStateParams} from 'sentry/views/dashboards/widgetBuilder/utils/convertWidgetToBuilderStateParams';
import {getTopNConvertedDefaultWidgets} from 'sentry/views/dashboards/widgetLibrary/data';

type WidgetBuilderSlideoutProps = {
  dashboard: DashboardDetails;
  dashboardFilters: DashboardFilters;
  isWidgetInvalid: boolean;
  onClose: () => void;
  onQueryConditionChange: (valid: boolean) => void;
  onSave: ({index, widget}: {index: number | undefined; widget: Widget}) => void;
  openWidgetTemplates: boolean;
  setIsPreviewDraggable: (draggable: boolean) => void;
  setOpenWidgetTemplates: (openWidgetTemplates: boolean) => void;
  onDataFetched?: (tableData: TableDataWithTitle[]) => void;
  thresholdMetaState?: ThresholdMetaState;
};

function WidgetBuilderSlideout({
  onClose,
  onSave,
  onQueryConditionChange,
  dashboard,
  dashboardFilters,
  setIsPreviewDraggable,
  isWidgetInvalid,
  openWidgetTemplates,
  setOpenWidgetTemplates,
  onDataFetched,
  thresholdMetaState,
}: WidgetBuilderSlideoutProps) {
  const organization = useOrganization();
  const location = useLocation();
  const {state, dispatch} = useWidgetBuilderContext();
  const [initialState] = useState(state);
  const [customizeFromLibrary, setCustomizeFromLibrary] = useState(false);
  const [error, setError] = useState<Record<string, any>>({});
  const theme = useTheme();
  const isEditing = useIsEditingWidget();
  const source = useDashboardWidgetSource();
  const {cacheBuilderState} = useCacheBuilderState();
  const {setSegmentSpanBuilderState} = useSegmentSpanWidgetState();
  const disableTransactionWidget = useDisableTransactionWidget();
  const isTransactionsWidget = state.dataset === WidgetType.TRANSACTIONS;
  const [showTransactionsDeprecationAlert, setShowTransactionsDeprecationAlert] =
    useState(
      organization.features.includes('performance-transaction-deprecation-banner')
    );
  const validatedWidgetResponse = useValidateWidgetQuery(
    convertBuilderStateToWidget(state)
  );

  useEffect(() => {
    if (!openWidgetTemplates) {
      trackAnalytics('dashboards_views.widget_builder.opened', {
        builder_version: WidgetBuilderVersion.SLIDEOUT,
        new_widget: !isEditing,
        organization,
        from: source,
      });
    }
    // Ignore isEditing because it won't change during the
    // useful lifetime of the widget builder, but it
    // flickers when an edited widget is saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openWidgetTemplates, organization]);

  const title = openWidgetTemplates
    ? t('Widget Library')
    : isEditing
      ? t('Edit Widget')
      : t('Custom Widget Builder');
  const isChartWidget = isChartDisplayType(state.displayType);

  const showVisualizeSection = state.displayType !== DisplayType.DETAILS;
  const showQueryFilterBuilder = !(
    state.dataset === WidgetType.ISSUE && isChartDisplayType(state.displayType)
  );
  const showGroupBySelector = isChartWidget && !(state.dataset === WidgetType.ISSUE);

  const isSmallScreen = useMedia(`(max-width: ${theme.breakpoints.sm})`);

  const showSortByStep =
    (isChartWidget && state.fields && state.fields.length > 0) ||
    state.displayType === DisplayType.TABLE;

  const observer = useMemo(
    () =>
      new IntersectionObserver(
        ([entry]) => {
          const isIntersecting = entry!.isIntersecting;
          setIsPreviewDraggable(!isIntersecting);
        },
        {threshold: 0}
      ),
    [setIsPreviewDraggable]
  );

  const observeForDraggablePreview = useCallback<RefCallback<HTMLDivElement>>(
    elem => {
      if (elem) {
        observer.observe(elem);
      } else if (!elem) {
        // According to React documentation and my observations of reality, this
        // will never happen. According to TypeScript, it might. Better safe
        // than sorry!
        observer.disconnect();
      }

      return () => {
        observer.disconnect();
      };
    },
    [observer]
  );

  const widgetLibraryWidgets = getTopNConvertedDefaultWidgets(organization);

  const widgetLibraryElement = (
    <SlideoutBreadcrumb
      onClick={() => {
        setCustomizeFromLibrary(false);
        setOpenWidgetTemplates(true);
        // clears the widget to start fresh on the library page
        dispatch({
          type: 'SET_STATE',
          payload: convertWidgetToBuilderStateParams(
            widgetLibraryWidgets[0] ?? ({} as Widget)
          ),
        });
      }}
    >
      {t('Widget Library')}
    </SlideoutBreadcrumb>
  );

  const onCloseWithModal = useCallback(() => {
    openConfirmModal({
      bypass: isEqual(initialState, state),
      message: t('You have unsaved changes. Are you sure you want to leave?'),
      priority: 'danger',
      onConfirm: onClose,
    });
  }, [initialState, onClose, state]);

  const breadcrumbs = customizeFromLibrary
    ? [
        {
          label: widgetLibraryElement,
          to: '',
        },
        {
          label: title,
          to: '',
        },
      ]
    : [
        {
          label: title,
          to: '',
        },
      ];

  const header = (
    <SlideoutHeaderWrapper>
      <Breadcrumbs crumbs={breadcrumbs} />
      <CloseButton
        priority="link"
        size="zero"
        borderless
        aria-label={t('Close Widget Builder')}
        icon={<IconClose size="sm" />}
        onClick={onCloseWithModal}
      >
        {t('Close')}
      </CloseButton>
    </SlideoutHeaderWrapper>
  );

  return (
    <SlideOverPanel
      position="left"
      data-test-id="widget-slideout"
      transitionProps={animationTransitionSettings}
    >
      {({isOpening}) => {
        if (isOpening) {
          return (
            <Fragment>
              {header}
              <Flex direction="column" gap="2xl" padding="2xl">
                <Placeholder height="50px" />
                <Placeholder height="50px" />
                <Placeholder height="50px" />
                <Placeholder height="200px" />
              </Flex>
            </Fragment>
          );
        }

        return (
          <Fragment>
            {header}
            <SlideoutBodyWrapper>
              {isTransactionsWidget && showTransactionsDeprecationAlert && (
                <Section>
                  <Alert
                    type="warning"
                    trailingItems={
                      <StyledCloseButton
                        icon={<IconClose size="sm" />}
                        aria-label={t('Close')}
                        onClick={() => {
                          setShowTransactionsDeprecationAlert(false);
                        }}
                        size="zero"
                        borderless
                      />
                    }
                  >
                    {disableTransactionWidget && isEditing
                      ? tct(
                          'Editing of transaction-based widgets is disabled, as we migrate to the span dataset. To expedite and re-enable edit functionality, switch to the [spans] dataset below with the [code:is_transaction:true] filter. Please read these [FAQLink:FAQs] for more information.',
                          {
                            spans: (
                              <Link
                                // We need to do this otherwise the dashboard filters will change
                                to={{
                                  pathname: location.pathname,
                                  query: {
                                    project: location.query.project,
                                    start: location.query.start,
                                    end: location.query.end,
                                    statsPeriod: location.query.statsPeriod,
                                    environment: location.query.environment,
                                    utc: location.query.utc,
                                  },
                                }}
                                onClick={() => {
                                  cacheBuilderState(state.dataset ?? WidgetType.ERRORS);
                                  setSegmentSpanBuilderState();
                                }}
                              >
                                {t('spans')}
                              </Link>
                            ),
                            FAQLink: (
                              <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/40366087871515-FAQ-Transactions-Spans-Migration" />
                            ),
                          }
                        )
                      : tct(
                          'The transactions dataset is being deprecated. Please use the Spans dataset with the [code:is_transaction:true] filter instead. Please read these [FAQLink:FAQs] for more information.',
                          {
                            FAQLink: (
                              <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/40366087871515-FAQ-Transactions-Spans-Migration" />
                            ),
                          }
                        )}
                  </Alert>
                </Section>
              )}
              {openWidgetTemplates ? (
                <Fragment>
                  <div ref={observeForDraggablePreview}>
                    {isSmallScreen && (
                      <Section>
                        <WidgetPreviewContainer
                          dashboard={dashboard}
                          dashboardFilters={dashboardFilters}
                          isWidgetInvalid={isWidgetInvalid}
                          onDataFetched={onDataFetched}
                          openWidgetTemplates={openWidgetTemplates}
                        />
                      </Section>
                    )}
                  </div>
                  {isSmallScreen && (
                    <Section>
                      <WidgetBuilderFilterBar
                        releases={dashboard.filters?.release ?? []}
                      />
                    </Section>
                  )}
                  <WidgetTemplatesList
                    onSave={onSave}
                    setOpenWidgetTemplates={setOpenWidgetTemplates}
                    setIsPreviewDraggable={setIsPreviewDraggable}
                    setCustomizeFromLibrary={setCustomizeFromLibrary}
                  />
                </Fragment>
              ) : (
                <Fragment>
                  <DisableTransactionWidget>
                    <Section>
                      <WidgetBuilderNameAndDescription
                        error={error}
                        setError={setError}
                      />
                    </Section>
                  </DisableTransactionWidget>
                  <Section>
                    <WidgetBuilderDatasetSelector />
                  </Section>
                  <DisableTransactionWidget>
                    <Section>
                      <WidgetBuilderTypeSelector error={error} setError={setError} />
                    </Section>
                    <div ref={observeForDraggablePreview}>
                      {isSmallScreen && (
                        <Section>
                          <WidgetPreviewContainer
                            dashboard={dashboard}
                            dashboardFilters={dashboardFilters}
                            isWidgetInvalid={isWidgetInvalid}
                            onDataFetched={onDataFetched}
                            openWidgetTemplates={openWidgetTemplates}
                          />
                        </Section>
                      )}
                    </div>
                    {isSmallScreen && (
                      <Section>
                        <WidgetBuilderFilterBar
                          releases={dashboard.filters?.release ?? []}
                        />
                      </Section>
                    )}
                    {showVisualizeSection && (
                      <Section>
                        <Visualize error={error} setError={setError} />
                      </Section>
                    )}

                    {showQueryFilterBuilder && (
                      <Section>
                        <WidgetBuilderQueryFilterBuilder
                          onQueryConditionChange={onQueryConditionChange}
                          validatedWidgetResponse={validatedWidgetResponse}
                        />
                      </Section>
                    )}
                    {state.displayType === DisplayType.BIG_NUMBER && (
                      <Section>
                        <ThresholdsSection
                          dataType={thresholdMetaState?.dataType}
                          dataUnit={thresholdMetaState?.dataUnit}
                          error={error}
                          setError={setError}
                        />
                      </Section>
                    )}
                    {showGroupBySelector && (
                      <Section>
                        <WidgetBuilderGroupBySelector
                          validatedWidgetResponse={validatedWidgetResponse}
                        />
                      </Section>
                    )}
                    {showSortByStep && (
                      <Section>
                        <WidgetBuilderSortBySelector />
                      </Section>
                    )}
                  </DisableTransactionWidget>
                  <SaveButtonGroup
                    isEditing={isEditing}
                    onSave={onSave}
                    setError={setError}
                    onClose={onCloseWithModal}
                  />
                </Fragment>
              )}
            </SlideoutBodyWrapper>
          </Fragment>
        );
      }}
    </SlideOverPanel>
  );
}

export default WidgetBuilderSlideout;

function Section({children}: {children: React.ReactNode}) {
  return (
    <SectionWrapper>
      <ErrorBoundary mini>{children}</ErrorBoundary>
    </SectionWrapper>
  );
}

type DisableModeProps = {
  children: React.ReactNode;
};

function DisableTransactionWidget({children}: DisableModeProps) {
  const disableTransactionWidget = useDisableTransactionWidget();

  if (!disableTransactionWidget) {
    return children;
  }

  return (
    <div
      data-test-id="transaction-widget-disabled-wrapper"
      style={{
        opacity: 0.6,
        cursor: 'not-allowed',
      }}
    >
      <div
        style={{
          pointerEvents: 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}

const CloseButton = styled(Button)`
  color: ${p => p.theme.subText};
  height: fit-content;
  &:hover {
    color: ${p => p.theme.colors.gray500};
  }
  z-index: 100;
`;

const SlideoutHeaderWrapper = styled('div')`
  padding: ${space(1)} ${space(4)};
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const SlideoutBreadcrumb = styled('div')`
  cursor: pointer;
`;

const SlideoutBodyWrapper = styled('div')`
  padding: ${p => p.theme.space['2xl']};
`;

const SectionWrapper = styled('div')`
  margin-bottom: 24px;
`;

const StyledCloseButton = styled(Button)`
  background-color: transparent;
  transition: opacity 0.1s linear;

  &:hover,
  &:focus {
    background-color: transparent;
    opacity: 1;
  }
`;
