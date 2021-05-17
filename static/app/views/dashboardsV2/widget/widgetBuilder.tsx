import {useEffect, useState} from 'react';
import {RouteComponentProps} from 'react-router';

import Alert from 'app/components/alert';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import {defined} from 'app/utils';

import {DashboardDetails, Widget} from '../types';

import EventWidget from './eventWidget';
import MetricWidget from './metricWidget';
import {DataSet} from './utils';

type RouteParams = {
  orgId: string;
  dashboardId: string;
  widgetId?: number;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  dashboard: DashboardDetails;
  onSave: (Widgets: Widget[]) => void;
  widget?: Widget;
};

function WidgetBuilder({
  dashboard,
  onSave,
  widget,
  params,
  location,
  router,
  organization,
}: Props) {
  const [dataSet, setDataSet] = useState<DataSet | undefined>(DataSet.EVENTS);
  const isEditing = !!widget;

  const {widgetId, orgId, dashboardId} = params;

  const goBackLocation = {
    pathname: dashboardId
      ? `/organizations/${orgId}/dashboard/${dashboardId}/`
      : `/organizations/${orgId}/dashboards/new/`,
    query: {...location.query, dataSet: undefined},
  };

  useEffect(() => {
    checkDataSet();
  });

  function checkDataSet() {
    const {query} = location;
    const queryDataSet = query?.dataSet;

    if (!queryDataSet) {
      router.replace({
        pathname: location.pathname,
        query: {...location.query, dataSet: DataSet.EVENTS},
      });
      return;
    }

    if (queryDataSet !== DataSet.EVENTS && queryDataSet !== DataSet.METRICS) {
      setDataSet(undefined);
      return;
    }

    if (queryDataSet === DataSet.METRICS) {
      if (dataSet === DataSet.METRICS) {
        return;
      }
      setDataSet(DataSet.METRICS);
      return;
    }

    if (dataSet === DataSet.EVENTS) {
      return;
    }

    setDataSet(DataSet.EVENTS);
  }

  function handleDataSetChange(newDataSet: DataSet) {
    router.replace({
      pathname: location.pathname,
      query: {
        ...location.query,
        dataSet: newDataSet,
      },
    });
  }

  if (!dataSet) {
    return (
      <Alert type="error" icon={<IconWarning />}>
        {t('Data set not found.')}
      </Alert>
    );
  }

  function handleAddWidget(newWidget: Widget) {
    onSave([...dashboard.widgets, newWidget]);
  }

  if (
    (isEditing && !defined(widgetId)) ||
    (isEditing && defined(widgetId) && !dashboard.widgets[widgetId])
  ) {
    return (
      <Alert type="error" icon={<IconWarning />}>
        {t('Widget not found.')}
      </Alert>
    );
  }

  function handleUpdateWidget(nextWidget: Widget) {
    if (!widgetId) {
      return;
    }

    const nextList = [...dashboard.widgets];
    nextList[widgetId] = nextWidget;
    onSave(nextList);
  }

  function handleDeleteWidget() {
    if (!widgetId) {
      return;
    }
    const nextList = [...dashboard.widgets];
    nextList.splice(widgetId, 1);
    onSave(nextList);
  }

  if (dataSet === DataSet.EVENTS) {
    return (
      <EventWidget
        dashboardTitle={dashboard.title}
        widget={widget}
        onAdd={handleAddWidget}
        onUpdate={handleUpdateWidget}
        onDelete={handleDeleteWidget}
        onChangeDataSet={handleDataSetChange}
        goBackLocation={goBackLocation}
        isEditing={isEditing}
      />
    );
  }

  return (
    <MetricWidget
      organization={organization}
      router={router}
      location={location}
      dashboardTitle={dashboard.title}
      params={params}
      goBackLocation={goBackLocation}
      onChangeDataSet={handleDataSetChange}
    />
  );
}

export default WidgetBuilder;
