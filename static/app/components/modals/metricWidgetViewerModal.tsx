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
import {getDdmUrl, getWidgetTitle} from 'sentry/utils/metrics';
import {emptyMetricsQueryWidget} from 'sentry/utils/metrics/constants';
import {convertToDashboardWidget, toDisplayType} from 'sentry/utils/metrics/dashboard';
import type {MetricQueryWidgetParams} from 'sentry/utils/metrics/types';
import type {MetricsQueryApiRequestQuery} from 'sentry/utils/metrics/useMetricsQuery';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  getMetricQueries,
  toMetricDisplayType,
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
  const [metricWidgetQueries, setMetricWidgetQueries] = useState<
    MetricsQueryApiRequestQuery[]
  >(getMetricQueries(widget, dashboardFilters));

  const widgetMQL = useMemo(
    () => getWidgetTitle(metricWidgetQueries),
    [metricWidgetQueries]
  );

  const [displayType, setDisplayType] = useState(toMetricDisplayType(widget.displayType));
  const [editedTitle, setEditedTitle] = useState<string>(widget.title);
  // If user renamed the widget, dislay that title, otherwise display the MQL
  const titleToDisplay = editedTitle === '' ? widgetMQL : editedTitle;

  const handleChange = useCallback(
    (data: Partial<MetricQueryWidgetParams>, index: number) => {
      setMetricWidgetQueries(curr => {
        const updated = [...curr];
        updated[index] = {...updated[index], ...data};
        return updated;
      });
    },
    [setMetricWidgetQueries]
  );

  const handleTitleChange = useCallback(
    (value: string) => {
      setEditedTitle(value || widgetMQL);
    },
    [setEditedTitle, widgetMQL]
  );

  const addQuery = useCallback(() => {
    setMetricWidgetQueries(curr => [...curr, emptyMetricsQueryWidget]);
  }, [setMetricWidgetQueries]);

  const removeQuery = useCallback(
    (index: number) => {
      setMetricWidgetQueries(curr => {
        const updated = [...curr];
        updated.splice(index, 1);
        return updated;
      });
    },
    [setMetricWidgetQueries]
  );

  const handleSubmit = useCallback(() => {
    const convertedWidget = convertToDashboardWidget(
      metricWidgetQueries.map(query => ({
        ...query,
        ...selection,
      }))
    );

    const updatedWidget = {
      ...widget,
      title: titleToDisplay,
      queries: convertedWidget.queries,
      displayType: toDisplayType(displayType),
    };

    onMetricWidgetEdit?.(updatedWidget);

    closeModal();
  }, [
    titleToDisplay,
    metricWidgetQueries,
    onMetricWidgetEdit,
    closeModal,
    widget,
    selection,
    displayType,
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
            metricWidgetQueries={metricWidgetQueries}
            handleChange={handleChange}
            addQuery={addQuery}
            removeQuery={removeQuery}
          />
          <MetricVisualization
            queries={metricWidgetQueries}
            displayType={displayType}
            onDisplayTypeChange={setDisplayType}
          />
          <MetricDetails
            mri={metricWidgetQueries[0].mri}
            query={metricWidgetQueries[0].query}
          />
        </Body>
        <Footer>
          <ButtonBar gap={1}>
            <LinkButton
              to={getDdmUrl(organization.slug, {
                widgets: metricWidgetQueries,
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
