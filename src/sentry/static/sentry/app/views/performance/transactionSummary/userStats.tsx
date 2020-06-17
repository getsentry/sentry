import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import {Organization} from 'app/types';
import space from 'app/styles/space';
import EventView from 'app/utils/discover/eventView';
import {t} from 'app/locale';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import QuestionTooltip from 'app/components/questionTooltip';
import {SectionHeading} from 'app/components/charts/styles';
import UserMisery from 'app/components/userMisery';
import {PERFORMANCE_TERMS} from 'app/views/performance/constants';

type Props = {
  location: Location;
  eventView: EventView;
  organization: Organization;
};

type Results = {
  [key: string]: React.ReactNode;
} | null;

const userMiseryLimit = 300;

class UserStats extends React.Component<Props> {
  generateUserStatsEventView(eventView: EventView): EventView {
    // narrow the search conditions of the Performance Summary event view
    // by modifying the columns to only show user impact and apdex scores

    eventView = eventView.withColumns([
      {
        kind: 'function',
        function: ['apdex', '', undefined],
      },
      {
        kind: 'function',
        function: ['user_misery', `${userMiseryLimit}`, undefined],
      },
      {
        kind: 'function',
        function: ['count_unique', 'user', undefined],
      },
    ]);

    eventView.sorts = [];

    return eventView;
  }

  renderContents(stats: Results, row?) {
    let userMisery = <StatNumber>{'\u2014'}</StatNumber>;

    if (stats) {
      const miserableUsers = Number(row[`user_misery_${userMiseryLimit}`]);
      const totalUsers = Number(row.count_unique_user);
      if (!isNaN(miserableUsers) && !isNaN(totalUsers)) {
        userMisery = (
          <UserMisery
            bars={40}
            barHeight={30}
            miseryLimit={userMiseryLimit}
            totalUsers={totalUsers}
            miserableUsers={miserableUsers}
          />
        );
      }
    }

    return (
      <Container>
        <div>
          <SectionHeading>{t('Apdex Score')}</SectionHeading>
          <StatNumber>{!stats ? '\u2014' : stats['apdex()']}</StatNumber>
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
              title={PERFORMANCE_TERMS.userMisery}
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
    const columnOrder = eventView.getColumns();

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
          const tableMeta = tableData.meta;
          const row = tableData.data[0];

          const stats: Results = columnOrder.reduce((acc, column) => {
            const field = String(column.key);

            const fieldRenderer = getFieldRenderer(field, tableMeta);

            acc[field] = fieldRenderer(row, {organization, location});

            return acc;
          }, {});
          return this.renderContents(stats, row);
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
