import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import {Organization} from 'app/types';
import space from 'app/styles/space';
import EventView from 'app/utils/discover/eventView';
import {t} from 'app/locale';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import {getTermHelp} from 'app/views/performance/data';
import DiscoverQuery, {TableDataRow} from 'app/utils/discover/discoverQuery';
import QuestionTooltip from 'app/components/questionTooltip';
import {SectionHeading} from 'app/components/charts/styles';
import UserMisery from 'app/components/userMisery';

type Props = {
  location: Location;
  eventView: EventView;
  organization: Organization;
};

class UserStats extends React.Component<Props> {
  generateUserStatsEventView(eventView: EventView): EventView {
    // narrow the search conditions of the Performance Summary event view
    // by modifying the columns to only show user misery and apdex scores
    const {organization} = this.props;
    const threshold = organization.apdexThreshold.toString();

    eventView = eventView.withColumns([
      {
        kind: 'function',
        function: ['apdex', threshold, undefined],
      },
      {
        kind: 'function',
        function: ['user_misery', threshold, undefined],
      },
      {
        kind: 'function',
        function: ['count_unique', 'user', undefined],
      },
    ]);

    eventView.sorts = [];

    return eventView;
  }

  renderContents(row: null | TableDataRow) {
    let userMisery = <StatNumber>{'\u2014'}</StatNumber>;
    const {organization, location} = this.props;
    const threshold = organization.apdexThreshold;
    let apdex: React.ReactNode = <StatNumber>{'\u2014'}</StatNumber>;

    if (row) {
      const miserableUsers = Number(row[`user_misery_${threshold}`]);
      const totalUsers = Number(row.count_unique_user);
      if (!isNaN(miserableUsers) && !isNaN(totalUsers)) {
        userMisery = (
          <UserMisery
            bars={40}
            barHeight={30}
            miseryLimit={threshold}
            totalUsers={totalUsers}
            miserableUsers={miserableUsers}
          />
        );
      }

      const apdexKey = `apdex_${threshold}`;
      const formatter = getFieldRenderer(apdexKey, {[apdexKey]: 'number'});
      apdex = formatter(row, {organization, location});
    }

    return (
      <Container>
        <div>
          <SectionHeading>{t('Apdex Score')}</SectionHeading>
          <StatNumber>{apdex}</StatNumber>
        </div>
        {/* <div>
          <SectionHeading>{t('Baseline Duration')}</SectionHeading>
          <StatNumber>{'\u2014'}</StatNumber>
        </div> */}
        <UserMiseryContainer>
          <SectionHeading>
            {t('User Misery')}
            <QuestionTooltip
              position="top"
              title={getTermHelp(organization, 'userMisery')}
              size="sm"
            />
          </SectionHeading>
          {userMisery}
        </UserMiseryContainer>
      </Container>
    );
  }

  render() {
    const {organization, location} = this.props;
    const eventView = this.generateUserStatsEventView(this.props.eventView);

    return (
      <DiscoverQuery
        eventView={eventView}
        orgSlug={organization.slug}
        location={location}
        limit={1}
      >
        {({tableData, isLoading}) => {
          const hasResults =
            tableData && tableData.data && tableData.meta && tableData.data.length > 0;

          if (
            isLoading ||
            !tableData ||
            !tableData.meta ||
            !hasResults ||
            !eventView.isValid()
          ) {
            return this.renderContents(null);
          }
          const row = tableData.data[0];
          return this.renderContents(row);
        }}
      </DiscoverQuery>
    );
  }
}

const Container = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-row-gap: ${space(4)};
  margin-bottom: 40px;
`;

const UserMiseryContainer = styled('div')`
  grid-column: 1/3;
`;

const StatNumber = styled('div')`
  font-size: 32px;
  color: ${p => p.theme.gray700};

  > div {
    text-align: left;
  }
`;

export default UserStats;
