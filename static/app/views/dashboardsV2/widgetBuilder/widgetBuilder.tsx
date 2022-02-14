import {useEffect, useState} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';
import {Organization} from 'sentry/types';
import {defined} from 'sentry/utils';

import {DashboardDetails, Widget} from '../types';

import BuildStep from './buildStep';
import BuildSteps from './buildSteps';
import Header from './header';
import {DataSet, DisplayType, displayTypes} from './utils';

const DATASET_CHOICES: [DataSet, string][] = [
  [DataSet.EVENTS, t('All Events (Errors and Transactions)')],
  [DataSet.ISSUES, t('Issues (States, Assignment, Time, etc.)')],
  [DataSet.METRICS, t('Metrics (Release Health)')],
];

type RouteParams = {
  orgId: string;
  dashboardId?: string;
  widgetId?: number;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  dashboard: DashboardDetails;
  onSave: (Widgets: Widget[]) => void;
  organization: Organization;
  widget?: Widget;
};

function WidgetBuilder({
  dashboard,
  widget,
  params,
  location,
  router,
  organization,
}: Props) {
  const {widgetId, orgId, dashboardId} = params;

  const isEditing = defined(widget);
  const dataSet = location.query.dataSet;
  const orgSlug = organization.slug;
  const goBackLocation = {
    pathname: dashboardId
      ? `/organizations/${orgId}/dashboard/${dashboardId}/`
      : `/organizations/${orgId}/dashboards/new/`,
    query: {...location.query, dataSet: undefined},
  };

  const [title, setTitle] = useState(
    t('Custom %s Widget', displayTypes[DisplayType.AREA])
  );

  useEffect(() => {
    if (!dataSet) {
      handleDataSetChange(DataSet.EVENTS);
    }
  }, [dataSet]);

  function handleDataSetChange(newDataSet: string) {
    router.replace({
      pathname: location.pathname,
      query: {
        ...location.query,
        dataSet: newDataSet,
      },
    });
  }

  // function handleAddWidget(newWidget: Widget) {
  //   onSave([...dashboard.widgets, newWidget]);
  // }

  // function handleUpdateWidget(nextWidget: Widget) {
  //   if (!widgetId) {
  //     return;
  //   }

  //   const nextList = [...dashboard.widgets];
  //   nextList[widgetId] = nextWidget;
  //   onSave(nextList);
  // }

  // function handleDeleteWidget() {
  //   if (!widgetId) {
  //     return;
  //   }
  //   const nextList = [...dashboard.widgets];
  //   nextList.splice(widgetId, 1);
  //   onSave(nextList);
  // }

  if (!Object.values(DataSet).includes(dataSet)) {
    return (
      <SentryDocumentTitle title={dashboard.title} orgSlug={orgSlug}>
        <PageContent>
          <LoadingError message={t('Data set not found.')} />
        </PageContent>
      </SentryDocumentTitle>
    );
  }

  if (
    isEditing &&
    (!defined(widgetId) ||
      !dashboard.widgets.find(dashboardWidget => dashboardWidget.id === String(widgetId)))
  ) {
    return (
      <SentryDocumentTitle title={dashboard.title} orgSlug={orgSlug}>
        <PageContent>
          <LoadingError message={t('Widget not found.')} />
        </PageContent>
      </SentryDocumentTitle>
    );
  }

  return (
    <SentryDocumentTitle title={dashboard.title} orgSlug={orgSlug}>
      <PageContentWithoutPadding>
        <Header
          orgSlug={orgSlug}
          title={title}
          dashboardTitle={dashboard.title}
          goBackLocation={goBackLocation}
          onChangeTitle={setTitle}
        />
        <Layout.Body>
          <BuildSteps>
            <BuildStep
              title={t('Choose your data set')}
              description={t(
                'Monitor specific events such as errors and transactions or metrics based on Release Health.'
              )}
            >
              <DataSetChoices
                label="dataSet"
                value={dataSet}
                choices={DATASET_CHOICES}
                onChange={handleDataSetChange}
              />
            </BuildStep>
            <BuildStep
              title={t('Choose your visualization')}
              description={t(
                'This is a preview of how your widget will appear in the dashboard.'
              )}
            >
              WIP
            </BuildStep>
            <BuildStep
              title={t('Choose your y-axis')}
              description="Description of what this means"
            >
              WIP
            </BuildStep>
            <BuildStep
              title={t('Filter your results')}
              description="Description of what this means"
            >
              WIP
            </BuildStep>
            <BuildStep
              title={t('Group your results')}
              description="Description of what this means"
            >
              WIP
            </BuildStep>
          </BuildSteps>
        </Layout.Body>
      </PageContentWithoutPadding>
    </SentryDocumentTitle>
  );
}

export default WidgetBuilder;

const PageContentWithoutPadding = styled(PageContent)`
  padding: 0;
`;

const DataSetChoices = styled(RadioGroup)`
  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-auto-flow: column;
  }
`;
