import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import {Organization} from 'app/types';
import space from 'app/styles/space';
import EventView from 'app/utils/discover/eventView';
import {t} from 'app/locale';
import {getFieldRenderer} from 'app/utils/discover/fieldRenderers';
import {assert} from 'app/types/utils';
import DiscoverQuery from 'app/utils/discover/discoverQuery';

type Props = {
  location: Location;
  eventView: EventView;
  organization: Organization;
};

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
        function: ['impact', '', undefined],
      },
    ]);

    eventView.sorts = [];

    return eventView;
  }

  render() {
    const {organization, location} = this.props;
    const eventView = this.generateUserStatsEventView(this.props.eventView);

    return (
      <DiscoverQuery
        eventView={eventView}
        orgSlug={organization.slug}
        location={location}
        extraQuery={{per_page: 1}}
      >
        {({tableData, isLoading}) => {
          const hasResults =
            tableData && tableData.data && tableData.meta && tableData.data.length > 0;

          if (isLoading || !tableData || !hasResults || !eventView.isValid()) {
            return null;
          }

          const columnOrder = eventView.getColumns();

          assert(tableData.meta);
          const tableMeta = tableData.meta;
          const row = tableData.data[0];

          const stats: {[key: string]: React.ReactNode} = columnOrder.reduce(
            (acc, column) => {
              const field = String(column.key);

              const fieldRenderer = getFieldRenderer(field, tableMeta);

              acc[field] = fieldRenderer(row, {organization, location});

              return acc;
            },
            {}
          );

          return (
            <Container>
              <div>
                <StatTitle>{t('Apdex Score')}</StatTitle>
                <StatNumber>{stats['apdex()']}</StatNumber>
              </div>
              <div>
                <StatTitle>{t('User Impact')}</StatTitle>
                <StatNumber>{stats['impact()']}</StatNumber>
              </div>
            </Container>
          );
        }}
      </DiscoverQuery>
    );
  }
}

const Container = styled('div')`
  margin-bottom: ${space(4)};
  display: flex;
  > * + * {
    margin-left: ${space(4)};
  }
`;

const StatTitle = styled('h4')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.gray3};
  margin: ${space(1)} 0 ${space(1.5)} 0;
`;

const StatNumber = styled('div')`
  font-size: 32px;
  color: ${p => p.theme.gray4};
`;

export default UserStats;
