import {Fragment, useCallback, useEffect, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {openConfirmModal} from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import ErrorBoundary from 'sentry/components/errorBoundary';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {WidgetBuilderVersion} from 'sentry/utils/analytics/dashboardsAnalyticsEvents';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import {useValidateWidgetQuery} from 'sentry/views/dashboards/hooks/useValidateWidget';
import {
  type DashboardDetails,
  type DashboardFilters,
  DisplayType,
  type Widget,
} from 'sentry/views/dashboards/types';
import {animationTransitionSettings} from 'sentry/views/dashboards/widgetBuilder/components/common/animationSettings';
import WidgetBuilderDatasetSelector from 'sentry/views/dashboards/widgetBuilder/components/datasetSelector';
import WidgetBuilderFilterBar from 'sentry/views/dashboards/widgetBuilder/components/filtersBar';
import WidgetBuilderGroupBySelector from 'sentry/views/dashboards/widgetBuilder/components/groupBySelector';
import WidgetBuilderNameAndDescription from 'sentry/views/dashboards/widgetBuilder/components/nameAndDescFields';
import {
  type ThresholdMetaState,
  WidgetPreviewContainer,
} from 'sentry/views/dashboards/widgetBuilder/components/newWidgetBuilder';
import WidgetBuilderQueryFilterBuilder from 'sentry/views/dashboards/widgetBuilder/components/queryFilterBuilder';
import SaveButtonGroup from 'sentry/views/dashboards/widgetBuilder/components/saveButtonGroup';
import WidgetBuilderSortBySelector from 'sentry/views/dashboards/widgetBuilder/components/sortBySelector';
import ThresholdsSection from 'sentry/views/dashboards/widgetBuilder/components/thresholds';
import WidgetBuilderTypeSelector from 'sentry/views/dashboards/widgetBuilder/components/typeSelector';
import Visualize from 'sentry/views/dashboards/widgetBuilder/components/visualize';
import WidgetTemplatesList from 'sentry/views/dashboards/widgetBuilder/components/widgetTemplatesList';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import useDashboardWidgetSource from 'sentry/views/dashboards/widgetBuilder/hooks/useDashboardWidgetSource';
import useIsEditingWidget from 'sentry/views/dashboards/widgetBuilder/hooks/useIsEditingWidget';
import {convertBuilderStateToWidget} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';
import {convertWidgetToBuilderStateParams} from 'sentry/views/dashboards/widgetBuilder/utils/convertWidgetToBuilderStateParams';
import {getTopNConvertedDefaultWidgets} from 'sentry/views/dashboards/widgetLibrary/data';

type WidgetBuilderSlideoutProps = {
  dashboard: DashboardDetails;
  dashboardFilters: DashboardFilters;
  isOpen: boolean;
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
  isOpen,
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
  const {state, dispatch} = useWidgetBuilderContext();
  const [initialState] = useState(state);
  const [customizeFromLibrary, setCustomizeFromLibrary] = useState(false);
  const [error, setError] = useState<Record<string, any>>({});
  const theme = useTheme();
  const isEditing = useIsEditingWidget();
  const source = useDashboardWidgetSource();
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
  const isChartWidget =
    state.displayType !== DisplayType.BIG_NUMBER &&
    state.displayType !== DisplayType.TABLE;

  const customPreviewRef = useRef<HTMLDivElement>(null);
  const templatesPreviewRef = useRef<HTMLDivElement>(null);

  const isSmallScreen = useMedia(`(max-width: ${theme.breakpoints.sm})`);

  const showSortByStep =
    (isChartWidget && state.fields && state.fields.length > 0) ||
    state.displayType === DisplayType.TABLE;

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsPreviewDraggable(!entry!.isIntersecting);
      },
      {threshold: 0}
    );

    // need two different refs to account for preview when customizing templates
    if (customPreviewRef.current) {
      observer.observe(customPreviewRef.current);
    }

    if (templatesPreviewRef.current) {
      observer.observe(templatesPreviewRef.current);
    }

    return () => observer.disconnect();
  }, [setIsPreviewDraggable, openWidgetTemplates]);

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

  return (
    <SlideOverPanel
      collapsed={!isOpen}
      slidePosition="left"
      data-test-id="widget-slideout"
      transitionProps={animationTransitionSettings}
    >
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
      <SlideoutBodyWrapper>
        {openWidgetTemplates ? (
          <Fragment>
            <div ref={templatesPreviewRef}>
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
                <WidgetBuilderFilterBar releases={dashboard.filters?.release ?? []} />
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
            <Section>
              <WidgetBuilderNameAndDescription error={error} setError={setError} />
            </Section>
            <Section>
              <WidgetBuilderDatasetSelector />
            </Section>
            <Section>
              <WidgetBuilderTypeSelector error={error} setError={setError} />
            </Section>
            <div ref={customPreviewRef}>
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
                <WidgetBuilderFilterBar releases={dashboard.filters?.release ?? []} />
              </Section>
            )}
            <Section>
              <Visualize error={error} setError={setError} />
            </Section>
            <Section>
              <WidgetBuilderQueryFilterBuilder
                onQueryConditionChange={onQueryConditionChange}
                validatedWidgetResponse={validatedWidgetResponse}
              />
            </Section>
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
            {isChartWidget && (
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
            <SaveButtonGroup
              isEditing={isEditing}
              onSave={onSave}
              setError={setError}
              onClose={onCloseWithModal}
            />
          </Fragment>
        )}
      </SlideoutBodyWrapper>
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

const CloseButton = styled(Button)`
  color: ${p => p.theme.subText};
  height: fit-content;
  &:hover {
    color: ${p => p.theme.gray400};
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
  padding: ${space(4)};
`;

const SectionWrapper = styled('div')`
  margin-bottom: 24px;
`;
