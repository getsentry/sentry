import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import {PanelTable} from 'app/components/panels';
import DateTime from 'app/components/dateTime';
import {Goal, Member, Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import ProgressRing from 'app/components/progressRing';
import {t} from 'app/locale';
import GlobalModal from 'app/components/globalModal';
import Button from 'app/components/button';
import {openModal} from 'app/actionCreators/modal';

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
    comparisonOperator: '>=',
    valueObjective: 0.9,
  },
];
class Goals extends React.Component<Props, State> {
  renderGoal = (goal: Goal) => {
    const {organization, projects, location} = this.props;

    const orgFeatures = new Set(organization.features);

    const searchConditions = tokenizeSearch('');
    searchConditions.setTag('event.type', ['transaction']);
    searchConditions.setTag('transaction', [goal.transactionName]);

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
          return (
            <React.Fragment key={goal.id}>
              <div>{goal.title}</div>
              <div>{goal.transactionName}</div>
              <div>{`${goal.aggregateObjective} ${goal.comparisonOperator} ${goal.valueObjective}`}</div>
              <DateTime date={goal.duedate} shortDate />
              <div>
                <ProgressRing value={goal.progress} size={40} barWidth={6} />
              </div>
              <div>{goal.description || '-'}</div>
              <div>{goal.owner.user.name}</div>
            </React.Fragment>
          );
        }}
      </DiscoverQuery>
    );
  };

  render() {
    return (
      <React.Fragment>
        <HeaderContainer>
          <Button
            onClick={() =>
              openModal(({closeModal, Header, Body}) => (
                <div>
                  <Header>Modal Header</Header>
                  <Body>
                    <div>Test Modal Body</div>
                    <Button onClick={closeModal}>Close</Button>
                  </Body>
                </div>
              ))
            }
          >
            Add Goal
          </Button>
        </HeaderContainer>
        <PanelTable
          headers={[
            t('Title'),
            t('Transaction Name'),
            t('Objective'),
            t('Due date'),
            t('Progress'),
            t('Description'),
            t('Created By'),
          ]}
          emptyMessage={t('This team has no goals')}
        >
          {goals.map(goal => this.renderGoal(goal))}
        </PanelTable>
        <GlobalModal />
      </React.Fragment>
    );
  }
}

const HeaderContainer = styled('div')`
  margin-bottom: 8px;
`;

export default Goals;
