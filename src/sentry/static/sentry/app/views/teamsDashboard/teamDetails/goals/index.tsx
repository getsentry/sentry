import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';
import isFinite from 'lodash/isFinite';

import {formatPercentage} from 'app/utils/formatters';
import {PanelTable} from 'app/components/panels';
import DiscoverButton from 'app/components/discoverButton';
import DateTime from 'app/components/dateTime';
import {Goal, Organization, Project} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import {tokenizeSearch, stringifyQueryObject} from 'app/utils/tokenizeSearch';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import {t} from 'app/locale';
import GlobalModal from 'app/components/globalModal';
import Button from 'app/components/button';
import {openModal} from 'app/actionCreators/modal';
import {getAggregateAlias} from 'app/utils/discover/fields';
import space from 'app/styles/space';
import {IconFlag} from 'app/icons';

import ModalAddGoal from './modalAddGoal';
import Sparkline from './sparkline';
import {goals} from './mocks';

type Props = {
  organization: Organization;
  projects: Project[];
  location: Location;
};

type State = {};

class Goals extends React.Component<Props, State> {
  renderGoal = (goal: Goal) => {
    const {organization, projects, location} = this.props;

    const orgFeatures = new Set(organization.features);

    const searchConditions = tokenizeSearch('');
    searchConditions.setTag('event.type', ['transaction']);
    searchConditions.setTag('transaction', [goal.transactionName]);

    const range = '30d';

    // if an org has no global-views, we make an assumption that errors are collected in the same
    // project as the current transaction event where spans are collected into
    const projs = orgFeatures.has('global-views') ? [] : projects.map(p => Number(p.id));

    const query = stringifyQueryObject(searchConditions);

    const eventView = EventView.fromSavedQuery({
      id: undefined,
      name: 'Transaction',
      fields: ['transaction', goal.aggregateObjective],
      orderby: '-timestamp',
      query,
      projects: projs,
      version: 2,
      range,
    });

    return (
      <DiscoverQuery
        key={goal.id}
        eventView={eventView}
        orgSlug={organization.slug}
        location={location}
      >
        {({isLoading, tableData}) => {
          if (isLoading || !tableData || !tableData?.data) {
            return null;
          }

          if (tableData.data.length <= 0) {
            return null;
          }

          const row = tableData.data[0];
          const needle = getAggregateAlias(goal.aggregateObjective);

          let currentValue = Number(row[needle]);

          if (!isFinite(currentValue)) {
            currentValue = 0;
          }

          return (
            <React.Fragment>
              <div>
                <DiscoverButton
                  to={eventView.getResultsViewUrlTarget(organization.slug)}
                  size="small"
                >
                  {goal.title}
                </DiscoverButton>
              </div>
              <div>{goal.transactionName}</div>
              <div>{`${goal.aggregateObjective} ${goal.comparisonOperator} ${goal.valueObjective}`}</div>
              <div>
                {goal.aggregateObjective.startsWith('slo')
                  ? formatPercentage(currentValue)
                  : currentValue}
              </div>
              <div>
                {/*<ProgressRing value={progress * 100} size={40} barWidth={6} />*/}
                <Sparkline
                  organization={organization}
                  query={query}
                  range={range}
                  projects={projs}
                  yAxis={goal.aggregateObjective}
                />
              </div>
              <DateTime date={goal.duedate} shortDate />
              <div>{goal.description || '-'}</div>
              <div>{goal.owner.user.name}</div>
            </React.Fragment>
          );
        }}
      </DiscoverQuery>
    );
  };

  handleSaveGoal = (goal: Partial<Goal>) => {
    console.log('goal', goal);
  };

  handleOpenAddGoalModal = () => {
    openModal(props => <ModalAddGoal {...props} onSave={this.handleSaveGoal} />);
  };

  render() {
    return (
      <React.Fragment>
        <HeaderContainer>
          <Button size="small" icon={<IconFlag />} onClick={this.handleOpenAddGoalModal}>
            {t('Add Goal')}
          </Button>
        </HeaderContainer>
        <PanelTable
          headers={[
            t('Title'),
            t('Transaction Name'),
            t('Objective'),
            t('Current'),
            t('Progress'),
            t('Due date'),
            t('Description'),
            t('Created By'),
          ]}
          emptyMessage={t('This team has no goals')}
        >
          {goals.map(this.renderGoal)}
        </PanelTable>
        <GlobalModal />
      </React.Fragment>
    );
  }
}

const HeaderContainer = styled('div')`
  margin-bottom: ${space(1)};
  display: flex;
  justify-content: flex-end;
`;

export default Goals;
