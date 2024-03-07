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
import {getDdmUrl, unescapeMetricsFormula} from 'sentry/utils/metrics';
import {convertToDashboardWidget, toDisplayType} from 'sentry/utils/metrics/dashboard';
import {formatMRIField, MRIToField} from 'sentry/utils/metrics/mri';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {
  DashboardMetricsExpression,
  DashboardMetricsQuery,
  Order,
} from 'sentry/views/dashboards/metrics/types';
import {
  expressionsToApiQueries,
  getMetricExpressions,
  isMetricsFormula,
  useGenerateExpressionId,
} from 'sentry/views/dashboards/metrics/utils';
import {MetricDetails} from 'sentry/views/ddm/widgetDetails';
import {OrganizationContext} from 'sentry/views/organizationContext';

interface Props extends ModalRenderProps, WidgetViewerModalOptions {
  organization: Organization;
}

function getWidgetTitle(queries: DashboardMetricsExpression[]) {
  return queries
    .map(q =>
      isMetricsFormula(q)
        ? unescapeMetricsFormula(q.formula)
        : formatMRIField(MRIToField(q.mri, q.op))
    )
    .join(', ');
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
  const [metricExpressions, setMetricExpressions] = useState<
    DashboardMetricsExpression[]
  >(getMetricExpressions(widget, dashboardFilters));

  const generateExpressionId = useGenerateExpressionId(metricExpressions);

  const metricQueries = useMemo(() => {
    return metricExpressions.filter(
      (e): e is DashboardMetricsQuery => !isMetricsFormula(e)
    );
  }, [metricExpressions]);

  const apiQueries = useMemo(
    () => expressionsToApiQueries(metricQueries),
    [metricQueries]
  );

  const widgetMQL = useMemo(() => getWidgetTitle(metricExpressions), [metricExpressions]);

  const [displayType, setDisplayType] = useState(widget.displayType);
  const [editedTitle, setEditedTitle] = useState<string>(widget.title);
  // If user renamed the widget, dislay that title, otherwise display the MQL
  const titleToDisplay = editedTitle === '' ? widgetMQL : editedTitle;

  const handleQueryChange = useCallback(
    (data: Partial<DashboardMetricsQuery>, index: number) => {
      setMetricExpressions(curr => {
        const updated = [...curr];
        updated[index] = {...updated[index], ...data} as DashboardMetricsQuery;
        return updated;
      });
    },
    [setMetricExpressions]
  );

  const handleOrderChange = useCallback((order: Order, index: number) => {
    setMetricExpressions(curr => {
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
    setMetricExpressions(curr => {
      return [
        ...curr,
        {
          ...metricExpressions[metricExpressions.length - 1],
          id: generateExpressionId(),
        },
      ];
    });
  }, [generateExpressionId, metricExpressions]);

  const removeQuery = useCallback(
    (index: number) => {
      setMetricExpressions(curr => {
        const updated = [...curr];
        updated.splice(index, 1);
        return updated;
      });
    },
    [setMetricExpressions]
  );

  const handleSubmit = useCallback(() => {
    // TODO: check saving id
    const convertedWidget = convertToDashboardWidget(metricQueries);

    const updatedWidget = {
      ...widget,
      title: titleToDisplay,
      queries: convertedWidget.queries,
      displayType: toDisplayType(displayType),
    };

    onMetricWidgetEdit?.(updatedWidget);

    closeModal();
  }, [
    metricQueries,
    widget,
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
            metricWidgetQueries={metricExpressions.filter(
              (q): q is DashboardMetricsQuery => !isMetricsFormula(q)
            )}
            handleChange={handleQueryChange}
            addQuery={addQuery}
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
