import React from 'react';

import IssueList from 'app/components/issueList';
import {Project} from 'app/types';

import Card from './index';
import {CardData} from '../types';
import withLocalStorage, {InjectedLocalStorageProps} from '../../../withLocalStorage';
import {getSelectedEnvironments} from '../../utils';
import {TAB} from '../../../utils';

type DefaultProps = Pick<CardData, 'key' | 'columnSpan' | 'data'>;

type Props = Card['props'] & {
  teamSlug: string;
  projects: Project[];
} & InjectedLocalStorageProps;

class CardIssueList extends React.Component<Props> {
  static defaultProps: DefaultProps = {
    columnSpan: 2,
    data: {},
  };

  render() {
    const {teamSlug, data, projects} = this.props;

    const environments = getSelectedEnvironments(teamSlug, data);

    const projectsFilter = (projects ?? []).map(p => p.id);

    return (
      <Card {...this.props} columnSpan={2} isRemovable={false}>
        <IssueList
          endpoint="/organizations/sentry/issues/"
          statsPeriod="24h"
          emptyText="No errors"
          showActions
          noBorder
          noMargin
          pagination={false}
          query={{
            statsPeriod: '90d',
            environment: environments,
            project: projectsFilter,
          }}
        />
      </Card>
    );
  }
}

export default withLocalStorage(CardIssueList, TAB.MY_TEAMS);
