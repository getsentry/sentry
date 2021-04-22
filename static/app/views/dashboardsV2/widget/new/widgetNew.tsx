import React, {useEffect, useState} from 'react';
import {RouteComponentProps} from 'react-router';

import Alert from 'app/components/alert';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {Organization} from 'app/types';

import {DashboardDetails, Widget} from '../../types';
import EventWidget from '../eventWidget';
import MetricWidget from '../metricWidget';
import {DataSet} from '../utils';

type RouteParams = {
  orgId: string;
  dashboardId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  dashboard: DashboardDetails;
  onSave: (widgets: Widget[]) => void;
  widget?: Widget;
};

function WidgetNew({onSave, widget, ...props}: Props) {
  const [dataSet, setDataSet] = useState<DataSet | undefined>(DataSet.EVENTS);

  useEffect(() => {
    checkDataSet();
  });

  function checkDataSet() {
    const {params, location, router} = props;
    const {orgId: orgSlug, dashboardId} = params;
    const {query} = location;
    const queryDataSet = query?.dataSet;

    if (!queryDataSet) {
      router.replace({
        pathname: `/organizations/${orgSlug}/dashboards/${dashboardId}/widget/new/`,
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
    const {params, location, router} = props;
    const {orgId: orgSlug, dashboardId} = params;
    router.replace({
      pathname: `/organizations/${orgSlug}/dashboards/${dashboardId}/widget/new/`,
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

  if (dataSet === DataSet.EVENTS) {
    return (
      <EventWidget
        {...props}
        widget={widget}
        onSave={onSave}
        onChangeDataSet={handleDataSetChange}
      />
    );
  }

  return <MetricWidget {...props} onChangeDataSet={handleDataSetChange} />;
}

export default WidgetNew;
