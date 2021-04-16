import React, {useEffect, useState} from 'react';
import {RouteComponentProps} from 'react-router';

import Alert from 'app/components/alert';
import {IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import {Organization} from 'app/types';

import EventWidget from '../eventWidget';
import MetricWidget from '../metricWidget';
import {DataSet} from '../utils';

type RouteParams = {
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
};

function WidgetNew(props: Props) {
  const [dataSet, setDataSet] = useState<DataSet | undefined>(DataSet.EVENTS);

  useEffect(() => {
    checkDataSet();
  });

  function checkDataSet() {
    const {params, location, router} = props;
    const {orgId: orgSlug} = params;
    const {query} = location;
    const queryDataSet = query?.dataSet;

    if (!queryDataSet) {
      router.replace({
        pathname: `/organizations/${orgSlug}/dashboards/widget/new/`,
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
    const {orgId: orgSlug} = params;
    router.replace({
      pathname: `/organizations/${orgSlug}/dashboards/widget/new/`,
      query: {
        ...location.query,
        dataSet: newDataSet,
      },
    });
  }

  if (!dataSet) {
    return (
      <PageContent>
        <Alert type="error" icon={<IconWarning />}>
          {t('Data set not found.')}
        </Alert>
      </PageContent>
    );
  }

  if (dataSet === DataSet.EVENTS) {
    return <EventWidget onChangeDataSet={handleDataSetChange} />;
  }

  return <MetricWidget {...props} onChangeDataSet={handleDataSetChange} />;
}

export default WidgetNew;
