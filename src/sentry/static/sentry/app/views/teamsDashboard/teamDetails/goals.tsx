import React from 'react';
import {Location} from 'history';

import {PanelTable} from 'app/components/panels';
import DateTime from 'app/components/dateTime';
import {Goal, Member, Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import ProgressRing from 'app/components/progressRing';
import {t} from 'app/locale';

type Props = {
  goals?: Array<Goal>;
  organization: Organization;
  projects: Project[];
  location: Location;
};

type State = {
  orgMemberList: Array<Member>;
  isDropdownBusy: boolean;
  query: string;
};

const goals: Array<Goal> = [
  {
    id: '1',
    dateCreated: String(new Date()),
    title: 'Finish Goals Page',
    duedate: String(new Date()),
    progress: 30,
    owner: {
      // @ts-ignore
      user: {
        id: '1',
        name: 'Jane Bloggs',
        email: 'janebloggs@example.com',
      },
      inviteStatus: 'requested_to_join',
    },
    transactionName: '/api/0/organizations/{organization_slug}/eventsv2/',
    aggregateObjective: 'apdex()',
    valueObjective: 0.9,
  },
];
class Goals extends React.Component<Props, State> {
  getTransactionGoals = (): Array<string> => {
    return ['/api/0/organizations/{organization_slug}/eventsv2/', '/api/0/assistant/'];
  };

  calculateGoals = () => {
    const {organization, projects, location} = this.props;
    const transactionGoals = this.getTransactionGoals();
    const orgFeatures = new Set(organization.features);

    const searchConditions = tokenizeSearch('');

    searchConditions.setTag('event.type', ['transaction']);

    if (transactionGoals.length > 0) {
      searchConditions.addOp('AND');
      searchConditions.addOp('(');
    }

    transactionGoals.forEach((transactionName, index) => {
      searchConditions.addTag('transaction', [transactionName]);

      if (index < transactionGoals.length - 1) {
        searchConditions.addOp('OR');
      }
    });

    if (transactionGoals.length > 0) {
      searchConditions.addOp(')');
    }

    console.log('query', stringifyQueryObject(searchConditions));

    const eventView = EventView.fromSavedQuery({
      id: undefined,
      name: 'Transaction',
      fields: [
        'transaction',
        'project',
        'epm()',
        'p50()',
        'p95()',
        'failure_rate()',
        `apdex(${organization.apdexThreshold})`,
        'count_unique(user)',
        `user_misery(${organization.apdexThreshold})`,
      ],
      orderby: '-timestamp',
      query: stringifyQueryObject(searchConditions),
      // if an org has no global-views, we make an assumption that errors are collected in the same
      // project as the current transaction event where spans are collected into
      projects: orgFeatures.has('global-views') ? [] : projects.map(p => Number(p.id)),
      version: 2,
      range: '90d',
    });

    return (
      <DiscoverQuery
        eventView={eventView}
        orgSlug={organization.slug}
        location={location}
      >
        {({isLoading, tableData}) => {
          if (isLoading) {
            return null;
          }
          console.log('tableData', tableData);
          return <div />;
        }}
      </DiscoverQuery>
    );
  };

  render() {
    return (
      <PanelTable
        headers={[
          t('Title'),
          t('Due date'),
          t('Progress'),
          t('Description'),
          t('Created By'),
        ]}
        emptyMessage={t('This team has no goals')}
      >
        {goals.map(goal => (
          <React.Fragment key={goal.id}>
            <div>{goal.title}</div>
            <DateTime date={goal.duedate} shortDate />
            <div>
              <ProgressRing value={goal.progress} size={40} barWidth={6} />
            </div>
            <div>{goal.description || '-'}</div>
            <div>{goal.owner.user.name}</div>
          </React.Fragment>
        ))}
        {this.calculateGoals()}
      </PanelTable>
    );
  }
}

export default Goals;
