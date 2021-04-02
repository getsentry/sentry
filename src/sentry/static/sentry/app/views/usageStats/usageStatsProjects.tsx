import React from 'react';
import moment from 'moment';

import AsyncComponent from 'app/components/asyncComponent';
import LoadingIndicator from 'app/components/loadingIndicator';
import {Panel, PanelBody} from 'app/components/panels';
import {DataCategory, Organization} from 'app/types';

import {ProjectUsageStats} from './types';

type Props = {
  organization: Organization;
  dataCategory: DataCategory;
  dataCategoryName: string;
  dateStart: moment.Moment;
  dateEnd: moment.Moment;
} & AsyncComponent['props'];

type State = {
  projectStats: ProjectUsageStats;
} & AsyncComponent['state'];

class UsageStatsProjects extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization} = this.props;

    return [
      [
        'orgStats',
        `/organizations/${organization.slug}/stats_v2/projects/`,
        {
          query: {
            interval: '1d',
          },
        },
      ],
    ];
  }

  renderError(e: Error) {
    return (
      <Panel>
        <PanelBody>UsageStatsProjects has an error: {e.message}</PanelBody>
      </Panel>
    );
  }

  renderLoading() {
    return (
      <Panel>
        <PanelBody>
          <LoadingIndicator />
        </PanelBody>
      </Panel>
    );
  }

  renderBody() {
    return (
      <Panel>
        <PanelBody>UsageStatsProjects is okay</PanelBody>
      </Panel>
    );
  }
}

export default UsageStatsProjects;
