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
import {hasCustomMetricsExtractionRules} from 'sentry/utils/metrics/features';
import {parseMRI} from 'sentry/utils/metrics/mri';
import {MetricExpressionType} from 'sentry/utils/metrics/types';
import {
  useVirtualMetricsContext,
  VirtualMetricsContextProvider,
} from 'sentry/utils/metrics/virtualMetricsContext';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {
  DashboardMetricsEquation,
  DashboardMetricsQuery,
  Order,
} from 'sentry/views/dashboards/metrics/types';
import {
  expressionsToWidget,
  getMetricEquations,
  getMetricQueries,
  getMetricWidgetTitle,
  useGenerateExpressionId,
} from 'sentry/views/dashboards/metrics/utils';
import {DisplayType} from 'sentry/views/dashboards/types';
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
  const {resolveVirtualMRI, getVirtualMRIQuery} = useVirtualMetricsContext();
  const [userHasModified, setUserHasModified] = useState(false);
  const [displayType, setDisplayType] = useState(widget.displayType);
  const [metricQueries, setMetricQueries] = useState<DashboardMetricsQuery[]>(() =>
    getMetricQueries(widget, dashboardFilters, getVirtualMRIQuery)
  );
  const [metricEquations, setMetricEquations] = useState<DashboardMetricsEquation[]>(() =>
    getMetricEquations(widget)
  );

  const filteredEquations = useMemo(
    () => metricEquations.filter(equation => equation.formula !== ''),
    [metricEquations]
  );

  const expressions = useMemo(
    () => [...metricQueries, ...filteredEquations],
    [metricQueries, filteredEquations]
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
      setUserHasModified(true);
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
      setUserHasModified(true);
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
      setUserHasModified(true);
    },
    [setMetricEquations]
  );

  const handleOrderChange = useCallback(
    ({id, order}: {id: number; order: Order}) => {
      setUserHasModified(true);

      const queryIdx = metricQueries.findIndex(query => query.id === id);
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
    [filteredEquations, metricQueries]
  );

  const addQuery = useCallback(
    (queryIndex?: number) => {
      setMetricQueries(curr => {
        const query = metricQueries[queryIndex ?? metricQueries.length - 1];
        return [
          ...(displayType === DisplayType.BIG_NUMBER
            ? curr.map(q => ({...q, isHidden: true}))
            : curr),
          {
            ...query,
            id: generateQueryId(),
          },
        ];
      });
      setUserHasModified(true);
    },
    [displayType, generateQueryId, metricQueries]
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

    // Hide all queries when adding an equation to a big number widget
    if (displayType === DisplayType.BIG_NUMBER) {
      setMetricQueries(curr => curr.map(q => ({...q, isHidden: true})));
    }

    setUserHasModified(true);
  }, [displayType, generateEquationId]);

  const removeEquation = useCallback(
    (index: number) => {
      setMetricEquations(curr => {
        const updated = [...curr];
        updated.splice(index, 1);
        return updated;
      });

      // Show the last query when removing an equation from a big number widget
      if (displayType === DisplayType.BIG_NUMBER) {
        setMetricQueries(curr =>
          curr.map((q, idx) => (idx === curr.length - 1 ? {...q, isHidden: false} : q))
        );
      }

      setUserHasModified(true);
    },
    [displayType]
  );

  const removeQuery = useCallback(
    (index: number) => {
      setMetricQueries(curr => {
        const updated = [...curr];
        updated.splice(index, 1);
        // Make sure the last query is visible for big number widgets
        if (displayType === DisplayType.BIG_NUMBER && filteredEquations.length === 0) {
          updated[updated.length - 1].isHidden = false;
        }
        return updated;
      });

      setUserHasModified(true);
    },
    [displayType, filteredEquations.length]
  );

  const handleSubmit = useCallback(() => {
    const resolvedQueries = metricQueries.map(query => {
      const {type} = parseMRI(query.mri);
      if (type !== 'v' || !query.condition) {
        return query;
      }

      const {mri, aggregation} = resolveVirtualMRI(
        query.mri,
        query.condition,
        query.aggregation
      );

      return {
        ...query,
        mri,
        aggregation,
      };
    });

    const convertedWidget = expressionsToWidget(
      [...resolvedQueries, ...filteredEquations],
      title.edited,
      toDisplayType(displayType),
      widget.interval
    );
    onMetricWidgetEdit?.({...widget, ...convertedWidget});

    closeModal();
  }, [
    metricQueries,
    filteredEquations,
    title.edited,
    displayType,
    widget,
    onMetricWidgetEdit,
    closeModal,
    resolveVirtualMRI,
  ]);

  const handleDisplayTypeChange = useCallback((type: DisplayType) => {
    setDisplayType(type);
    setUserHasModified(true);
  }, []);

  const handleClose = useCallback(() => {
    if (
      userHasModified &&
      // eslint-disable-next-line no-alert
      !window.confirm(t('You have unsaved changes, are you sure you want to close?'))
    ) {
      return;
    }
    closeModal();
  }, [userHasModified, closeModal]);

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
          <CloseButton onClick={handleClose} />
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
            onDisplayTypeChange={handleDisplayTypeChange}
            onOrderChange={handleOrderChange}
            interval={widget.interval}
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

function WrappedMetricWidgetViewerModal(props: Props) {
  return hasCustomMetricsExtractionRules(props.organization) ? (
    <VirtualMetricsContextProvider>
      <MetricWidgetViewerModal {...props} />
    </VirtualMetricsContextProvider>
  ) : (
    <MetricWidgetViewerModal {...props} />
  );
}

export default WrappedMetricWidgetViewerModal;

export const modalCss = css`
  width: 100%;
  max-width: 1200px;
`;
