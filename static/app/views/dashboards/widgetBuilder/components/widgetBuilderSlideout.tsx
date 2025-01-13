import {Fragment, useEffect, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {Button} from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import SlideOverPanel from 'sentry/components/slideOverPanel';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  type DashboardDetails,
  type DashboardFilters,
  DisplayType,
  type Widget,
  WidgetType,
} from 'sentry/views/dashboards/types';
import WidgetBuilderDatasetSelector from 'sentry/views/dashboards/widgetBuilder/components/datasetSelector';
import WidgetBuilderFilterBar from 'sentry/views/dashboards/widgetBuilder/components/filtersBar';
import WidgetBuilderGroupBySelector from 'sentry/views/dashboards/widgetBuilder/components/groupBySelector';
import WidgetBuilderNameAndDescription from 'sentry/views/dashboards/widgetBuilder/components/nameAndDescFields';
import {WidgetPreviewContainer} from 'sentry/views/dashboards/widgetBuilder/components/newWidgetBuilder';
import WidgetBuilderQueryFilterBuilder from 'sentry/views/dashboards/widgetBuilder/components/queryFilterBuilder';
import RPCToggle from 'sentry/views/dashboards/widgetBuilder/components/rpcToggle';
import SaveButton from 'sentry/views/dashboards/widgetBuilder/components/saveButton';
import WidgetBuilderSortBySelector from 'sentry/views/dashboards/widgetBuilder/components/sortBySelector';
import WidgetBuilderTypeSelector from 'sentry/views/dashboards/widgetBuilder/components/typeSelector';
import Visualize from 'sentry/views/dashboards/widgetBuilder/components/visualize';
import WidgetTemplatesList from 'sentry/views/dashboards/widgetBuilder/components/widgetTemplatesList';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

type WidgetBuilderSlideoutProps = {
  dashboard: DashboardDetails;
  dashboardFilters: DashboardFilters;
  isOpen: boolean;
  isWidgetInvalid: boolean;
  onClose: () => void;
  onQueryConditionChange: (valid: boolean) => void;
  onSave: ({index, widget}: {index: number; widget: Widget}) => void;
  openWidgetTemplates: boolean;
  setIsPreviewDraggable: (draggable: boolean) => void;
  setOpenWidgetTemplates: (openWidgetTemplates: boolean) => void;
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
}: WidgetBuilderSlideoutProps) {
  const organization = useOrganization();
  const {state} = useWidgetBuilderContext();
  const [initialState] = useState(state);
  const [error, setError] = useState<Record<string, any>>({});
  const {widgetIndex} = useParams();
  const theme = useTheme();

  // TODO: remove this once we have a proper way to handle templates
  // const showTemplates = localStorage.getItem('showTemplates') === 'true';

  const isEditing = widgetIndex !== undefined;
  const title = openWidgetTemplates
    ? t('Add from Widget Library')
    : isEditing
      ? t('Edit Widget')
      : t('Create Custom Widget');
  const isChartWidget =
    state.displayType !== DisplayType.BIG_NUMBER &&
    state.displayType !== DisplayType.TABLE;

  const previewRef = useRef<HTMLDivElement>(null);

  const isSmallScreen = useMedia(`(max-width: ${theme.breakpoints.small})`);

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

    if (previewRef.current) {
      observer.observe(previewRef.current);
    }

    return () => observer.disconnect();
  }, [setIsPreviewDraggable]);

  return (
    <SlideOverPanel
      collapsed={!isOpen}
      slidePosition="left"
      data-test-id="widget-slideout"
    >
      <SlideoutHeaderWrapper>
        <SlideoutTitle>{title}</SlideoutTitle>
        <CloseButton
          priority="link"
          size="zero"
          borderless
          aria-label={t('Close Widget Builder')}
          icon={<IconClose size="sm" />}
          onClick={() => {
            openConfirmModal({
              bypass: isEqual(initialState, state),
              message: t('You have unsaved changes. Are you sure you want to leave?'),
              priority: 'danger',
              onConfirm: onClose,
            });
          }}
        >
          {t('Close')}
        </CloseButton>
      </SlideoutHeaderWrapper>
      <SlideoutBodyWrapper>
        {!openWidgetTemplates ? (
          <Fragment>
            <Section>
              <WidgetBuilderFilterBar />
            </Section>
            <Section>
              <WidgetBuilderDatasetSelector />
            </Section>
            {organization.features.includes('visibility-explore-dataset') &&
              state.dataset === WidgetType.SPANS && (
                <Section>
                  <RPCToggle />
                </Section>
              )}
            <Section>
              <WidgetBuilderTypeSelector error={error} setError={setError} />
            </Section>
            <div ref={previewRef}>
              {isSmallScreen && (
                <Section>
                  <WidgetPreviewContainer
                    dashboard={dashboard}
                    dashboardFilters={dashboardFilters}
                    isWidgetInvalid={isWidgetInvalid}
                  />
                </Section>
              )}
            </div>
            <Section>
              <Visualize error={error} setError={setError} />
            </Section>
            <Section>
              <WidgetBuilderQueryFilterBuilder
                onQueryConditionChange={onQueryConditionChange}
              />
            </Section>
            {isChartWidget && (
              <Section>
                <WidgetBuilderGroupBySelector />
              </Section>
            )}
            {showSortByStep && (
              <Section>
                <WidgetBuilderSortBySelector />
              </Section>
            )}
            <Section>
              <WidgetBuilderNameAndDescription error={error} setError={setError} />
            </Section>
            <SaveButton isEditing={isEditing} onSave={onSave} setError={setError} />
          </Fragment>
        ) : (
          <Fragment>
            <div ref={previewRef}>
              {isSmallScreen && (
                <Section>
                  <WidgetPreviewContainer
                    dashboard={dashboard}
                    dashboardFilters={dashboardFilters}
                    isWidgetInvalid={isWidgetInvalid}
                  />
                </Section>
              )}
            </div>
            <WidgetTemplatesList setOpenWidgetTemplates={setOpenWidgetTemplates} />
          </Fragment>
        )}
      </SlideoutBodyWrapper>
    </SlideOverPanel>
  );
}

export default WidgetBuilderSlideout;

const CloseButton = styled(Button)`
  color: ${p => p.theme.gray300};
  height: fit-content;
  &:hover {
    color: ${p => p.theme.gray400};
  }
  z-index: 100;
`;

const SlideoutTitle = styled('h5')`
  margin: 0;
`;

const SlideoutHeaderWrapper = styled('div')`
  padding: ${space(3)} ${space(4)};
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const SlideoutBodyWrapper = styled('div')`
  padding: ${space(4)};
`;

const Section = styled('div')`
  margin-bottom: ${space(4)};
`;
