import {Fragment, useCallback, useMemo, useState} from 'react';
import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {
  MetricWidgetTitle,
  type MetricWidgetTitleState,
} from 'sentry/components/modals/metricWidgetViewerModal/header';
import {Queries} from 'sentry/components/modals/metricWidgetViewerModal/queries';
import {MetricVisualization} from 'sentry/components/modals/metricWidgetViewerModal/visualization';
import type {WidgetViewerModalOptions} from 'sentry/components/modals/widgetViewerModal';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {getMetricsUrl} from 'sentry/utils/metrics';
import {toDisplayType} from 'sentry/utils/metrics/dashboard';
import {MetricExpressionType} from 'sentry/utils/metrics/types';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {
  DashboardMetricsEquation,
  DashboardMetricsQuery,
  Order,
} from 'sentry/views/dashboards/metrics/types';
import {
  expressionsToWidget,
  filterEquationsByDisplayType,
  filterQueriesByDisplayType,
  getMetricEquations,
  getMetricQueries,
  getMetricWidgetTitle,
  useGenerateExpressionId,
} from 'sentry/views/dashboards/metrics/utils';
import {MetricDetails} from 'sentry/views/metrics/widgetDetails';
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
  CloseButton,
  onMetricWidgetEdit,
  dashboardFilters,
}: Props) {
  const {selection} = usePageFilters();
  const [displayType, setDisplayType] = useState(widget.displayType);
  const [interval, setInterval] = useState<string>(widget.interval);
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

  const expressions = useMemo(
    () => [...filteredQueries, ...filteredEquations],
    [filteredQueries, filteredEquations]
  );

  const generateQueryId = useGenerateExpressionId(metricQueries);
  const generateEquationId = useGenerateExpressionId(metricEquations);

  const widgetMQL = useMemo(() => getMetricWidgetTitle(expressions), [expressions]);

  const [title, setTitle] = useState<MetricWidgetTitleState>({
    stored: widget.title,
    edited: widget.title,
    isEditing: false,
  });

  const handleTitleChange = useCallback(
    (patch: Partial<MetricWidgetTitleState>) => {
      setTitle(curr => ({...curr, ...patch}));
    },
    [setTitle]
  );

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

  const handleOrderChange = useCallback(
    ({id, order}: {id: number; order: Order}) => {
      const queryIdx = filteredQueries.findIndex(query => query.id === id);
      if (queryIdx > -1) {
        setMetricQueries(curr => {
          return curr.map((query, i) => {
            const orderBy = i === queryIdx ? order : undefined;
            return {...query, orderBy};
          });
        });
        return;
      }

      const equationIdx = filteredEquations.findIndex(equation => equation.id === id);
      if (equationIdx > -1) {
        setMetricEquations(curr => {
          return curr.map((equation, i) => {
            const orderBy = i === equationIdx ? order : undefined;
            return {...equation, orderBy};
          });
        });
      }
    },
    [filteredEquations, filteredQueries]
  );

  const addQuery = useCallback(
    (queryIndex?: number) => {
      setMetricQueries(curr => {
        const query = metricQueries[queryIndex ?? metricQueries.length - 1];
        return [
          ...curr,
          {
            ...query,
            id: generateQueryId(),
          },
        ];
      });
    },
    [generateQueryId, metricQueries]
  );

  const addEquation = useCallback(() => {
    setMetricEquations(curr => {
      return [
        ...curr,
        {
          formula: '',
          name: '',
          id: generateEquationId(),
          type: MetricExpressionType.EQUATION,
          isHidden: false,
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
      title.edited,
      toDisplayType(displayType),
      // TODO(metrics): for now we do not persist the interval by default
      // as we need to find a way to handle per widget interval perferences
      // with the dashboard interval preferences
      widget.interval ?? interval
    );

    onMetricWidgetEdit?.(convertedWidget);

    closeModal();
  }, [
    filteredQueries,
    filteredEquations,
    title.edited,
    displayType,
    onMetricWidgetEdit,
    closeModal,
    interval,
    widget.interval,
  ]);

  return (
    <Fragment>
      <OrganizationContext.Provider value={organization}>
        <Header>
          <MetricWidgetTitle
            title={title}
            onTitleChange={handleTitleChange}
            placeholder={widgetMQL}
            description={widget.description}
          />
          {/* Added a div with onClick because CloseButton overrides passed onClick handler */}
          <div onClick={handleSubmit}>
            <CloseButton />
          </div>
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
            expressions={expressions}
            displayType={displayType}
            onDisplayTypeChange={setDisplayType}
            onOrderChange={handleOrderChange}
            onIntervalChange={setInterval}
            interval={interval}
          />
          <MetricDetails mri={metricQueries[0].mri} query={metricQueries[0].query} />
        </Body>
        <Footer>
          <ButtonBar gap={1}>
            <LinkButton
              to={getMetricsUrl(organization.slug, {
                widgets: [...metricQueries, ...metricEquations],
                ...selection.datetime,
                project: selection.projects,
                environment: selection.environments,
              })}
            >
              {t('Open in Metrics')}
            </LinkButton>
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
