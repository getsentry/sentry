import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import {Organization} from 'app/types';
import space from 'app/styles/space';
import EventView from 'app/utils/discover/eventView';
import {t} from 'app/locale';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import {SectionHeading} from 'app/components/charts/styles';
import ScoreBar from 'app/components/scoreBar';
import Tooltip from 'app/components/tooltip';
import theme from 'app/utils/theme';

type Props = {
  location: Location;
  eventView: EventView;
  organization: Organization;
};

type Results = {
  [key: string]: React.ReactNode;
} | null;

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
        function: ['user_misery', '300', undefined],
      },
    ]);

    eventView.sorts = [];

    return eventView;
  }

  renderContents(stats: Results) {
    const palette = new Array(40).fill(theme.purpleDarkest);
    const miseryScore = !stats ? '\u2014' : stats['user_misery(300)'];

    return (
      <Container>
        <div>
          <SectionHeading>{t('Apdex Score')}</SectionHeading>
          <StatNumber>{!stats ? '\u2014' : stats['apdex()']}</StatNumber>
        </div>
        <div>
          <SectionHeading>{t('Baseline Duration')}</SectionHeading>
          <StatNumber>{'\u2014'}</StatNumber>
        </div>
        <BarContainer>
          <SectionHeading>{t('User Misery')}</SectionHeading>
          <Tooltip title={miseryScore}>
            <ScoreBar size={30} score={0} palette={palette} radius={0} />
          </Tooltip>
        </BarContainer>
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
          return this.renderContents(stats);
        }}
      </DiscoverQuery>
    );
  }
}

const Container = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-row-gap: ${space(4)};
  margin-bottom: 48px;
`;

const BarContainer = styled('div')`
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
