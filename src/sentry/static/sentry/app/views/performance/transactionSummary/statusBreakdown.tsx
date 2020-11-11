import React from 'react';
import {Location} from 'history';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {LightWeightOrganization} from 'app/types';
import BreakdownBars from 'app/components/charts/breakdownBars';
import {SectionHeading} from 'app/components/charts/styles';
import Placeholder from 'app/components/placeholder';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import ErrorPanel from 'app/components/charts/errorPanel';
import {IconWarning} from 'app/icons';
import QuestionTooltip from 'app/components/questionTooltip';
import EventView from 'app/utils/discover/eventView';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import {getTermHelp} from 'app/views/performance/data';
import space from 'app/styles/space';

type Props = {
  organization: LightWeightOrganization;
  location: Location;
  eventView: EventView;
};

function StatusBreakdown({eventView, location, organization}: Props) {
  const breakdownView = eventView
    .withColumns([
      {kind: 'function', function: ['count', '', '']},
      {kind: 'field', field: 'transaction.status'},
    ])
    .withSorts([{kind: 'desc', field: 'count'}]);

  return (
    <Container>
      <SectionHeading>
        {t('Status Breakdown')}
        <QuestionTooltip
          position="top"
          title={getTermHelp(organization, 'statusBreakdown')}
          size="sm"
        />
      </SectionHeading>
      <DiscoverQuery
        eventView={breakdownView}
        location={location}
        orgSlug={organization.slug}
      >
        {({isLoading, error, tableData}) => {
          if (isLoading) {
            return <Placeholder height="125px" />;
          }
          if (error) {
            return (
              <ErrorPanel height="125px">
                <IconWarning color="gray300" size="lg" />
              </ErrorPanel>
            );
          }
          if (!tableData || tableData.data.length === 0) {
            return <EmptyStateWarning small>{t('No data available')}</EmptyStateWarning>;
          }
          const points = tableData.data.map(row => ({
            label: String(row['transaction.status']),
            value: parseInt(String(row.count), 10),
          }));
          return <BreakdownBars data={points} />;
        }}
      </DiscoverQuery>
    </Container>
  );
}

export default StatusBreakdown;

const Container = styled('div')`
  margin-bottom: ${space(4)};
`;
