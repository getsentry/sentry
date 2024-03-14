import {Fragment, useCallback, useMemo, useState} from 'react';
import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {WidgetTitle} from 'sentry/components/modals/metricWidgetViewerModal/header';
import {Queries} from 'sentry/components/modals/metricWidgetViewerModal/queries';
import {MetricVisualization} from 'sentry/components/modals/metricWidgetViewerModal/visualization';
import type {WidgetViewerModalOptions} from 'sentry/components/modals/widgetViewerModal';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types';
import {getDdmUrl} from 'sentry/utils/metrics';
import {toDisplayType} from 'sentry/utils/metrics/dashboard';
import {MetricQueryType} from 'sentry/utils/metrics/types';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {
  DashboardMetricsEquation,
  DashboardMetricsQuery,
  Order,
} from 'sentry/views/dashboards/metrics/types';
import {
  expressionsToApiQueries,
  expressionsToWidget,
  filterEquationsByDisplayType,
  filterQueriesByDisplayType,
  getMetricEquations,
  getMetricQueries,
  getMetricWidgetTitle,
  useGenerateExpressionId,
} from 'sentry/views/dashboards/metrics/utils';
import {MetricDetails} from 'sentry/views/ddm/widgetDetails';
import {OrganizationContext} from 'sentry/views/organizationContext';

interface Props extends ModalRenderProps, WidgetViewerModalOptions {
  organization: Organization;
}

function MetricWidgetViewerModal({
  organization,
  widget,
  Footer,
  Body,
  Header,
  closeModal,
  onMetricWidgetEdit,
  dashboardFilters,
}: Props) {
  const {selection} = usePageFilters();
  const [displayType, setDisplayType] = useState(widget.displayType);
  const [editedTitle, setEditedTitle] = useState<string>(widget.title);
  const [metricQueries, setMetricQueries] = useState<DashboardMetricsQuery[]>(() =>
    getMetricQueries(widget, dashboardFilters)
  );
  const [metricEquations, setMetricEquations] = useState<DashboardMetricsEquation[]>(() =>
    getMetricEquations(widget)
  );

  const filteredQueries = useMemo(
    () => filterQueriesByDisplayType(metricQueries, displayType),
    [metricQueries, displayType]
  );

  const filteredEquations = useMemo(
    () =>
      filterEquationsByDisplayType(metricEquations, displayType).filter(
        equation => equation.formula !== ''
      ),
    [metricEquations, displayType]
  );

  const generateQueryId = useGenerateExpressionId(metricQueries);
  const generateEquationId = useGenerateExpressionId(metricEquations);

  const apiQueries = useMemo(
    () => expressionsToApiQueries([...filteredQueries, ...filteredEquations]),
    [filteredQueries, filteredEquations]
  );

  const widgetMQL = useMemo(
    () => getMetricWidgetTitle([...filteredQueries, ...filteredEquations]),
    [filteredQueries, filteredEquations]
  );

  // If user renamed the widget, dislay that title, otherwise display the MQL
  const titleToDisplay = editedTitle === '' ? widgetMQL : editedTitle;

  const handleQueryChange = useCallback(
    (data: Partial<DashboardMetricsQuery>, index: number) => {
      setMetricQueries(curr => {
        const updated = [...curr];
        updated[index] = {...updated[index], ...data} as DashboardMetricsQuery;
        return updated;
      });
    },
    [setMetricQueries]
  );

  const handleEquationChange = useCallback(
    (data: Partial<DashboardMetricsEquation>, index: number) => {
      setMetricEquations(curr => {
        const updated = [...curr];
        updated[index] = {...updated[index], ...data} as DashboardMetricsEquation;
        return updated;
      });
    },
    [setMetricEquations]
  );

  const handleOrderChange = useCallback((order: Order, index: number) => {
    setMetricQueries(curr => {
      return curr.map((query, i) => {
        const orderBy = i === index ? order : undefined;
        return {...query, orderBy};
      });
    });
  }, []);

  const handleTitleChange = useCallback(
    (value: string) => {
      setEditedTitle(value || widgetMQL);
    },
    [setEditedTitle, widgetMQL]
  );

  const addQuery = useCallback(() => {
    setMetricQueries(curr => {
      return [
        ...curr,
        {
          ...metricQueries[metricQueries.length - 1],
          id: generateQueryId(),
        },
      ];
    });
  }, [generateQueryId, metricQueries]);

  const addEquation = useCallback(() => {
    setMetricEquations(curr => {
      return [
        ...curr,
        {
          formula: '',
          id: generateEquationId(),
          type: MetricQueryType.FORMULA,
        },
      ];
    });
  }, [generateEquationId]);

  const removeEquation = useCallback(
    (index: number) => {
      setMetricEquations(curr => {
        const updated = [...curr];
        updated.splice(index, 1);
        return updated;
      });
    },
    [setMetricEquations]
  );

  const removeQuery = useCallback(
    (index: number) => {
      setMetricQueries(curr => {
        const updated = [...curr];
        updated.splice(index, 1);
        return updated;
      });
    },
    [setMetricQueries]
  );

  const handleSubmit = useCallback(() => {
    const convertedWidget = expressionsToWidget(
      [...filteredQueries, ...filteredEquations],
      titleToDisplay,
      toDisplayType(displayType)
    );

    onMetricWidgetEdit?.(convertedWidget);

    closeModal();
  }, [
    filteredQueries,
    filteredEquations,
    titleToDisplay,
    displayType,
    onMetricWidgetEdit,
    closeModal,
  ]);

  return (
    <Fragment>
      <OrganizationContext.Provider value={organization}>
        <Header closeButton>
          <WidgetTitle
            value={editedTitle}
            displayValue={titleToDisplay}
            placeholder={widgetMQL}
            onSubmit={handleTitleChange}
            description={widget.description}
          />
        </Header>
        <Body>
          <Queries
            displayType={displayType}
            metricQueries={metricQueries}
            metricEquations={metricEquations}
            onQueryChange={handleQueryChange}
            onEquationChange={handleEquationChange}
            addEquation={addEquation}
            addQuery={addQuery}
            removeEquation={removeEquation}
            removeQuery={removeQuery}
          />
          <MetricVisualization
            queries={apiQueries}
            displayType={displayType}
            onDisplayTypeChange={setDisplayType}
            onOrderChange={handleOrderChange}
          />
          <MetricDetails mri={metricQueries[0].mri} query={metricQueries[0].query} />
        </Body>
        <Footer>
          <ButtonBar gap={1}>
            <LinkButton
              to={getDdmUrl(organization.slug, {
                widgets: metricQueries,
                ...selection.datetime,
                project: selection.projects,
                environment: selection.environments,
              })}
            >
              {t('Open in Metrics')}
            </LinkButton>
            <Button onClick={closeModal}>{t('Close')}</Button>
            <Button priority="primary" onClick={handleSubmit}>
              {t('Save changes')}
            </Button>
          </ButtonBar>
        </Footer>
      </OrganizationContext.Provider>
    </Fragment>
  );
}

export default MetricWidgetViewerModal;

export const modalCss = css`
  width: 100%;
  max-width: 1200px;
`;
