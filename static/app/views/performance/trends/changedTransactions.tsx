import styled from '@emotion/styled';
import type {Location} from 'history';

import type {Client} from 'sentry/api';
import Duration from 'sentry/components/duration';
import {IconArrow} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

import type {NormalizedTrendsTransaction, TrendChangeType, TrendView} from './types';
import {transformDeltaSpread} from './utils';

type TrendsListItemProps = {
  api: Client;
  currentTrendColumn: string;
  currentTrendFunction: string;
  handleSelectTransaction: (transaction: NormalizedTrendsTransaction) => void;
  index: number;
  location: Location;
  organization: Organization;
  projects: Project[];
  transaction: NormalizedTrendsTransaction;
  transactions: NormalizedTrendsTransaction[];
  trendChangeType: TrendChangeType;
  trendView: TrendView;
};

export function CompareDurations({
  transaction,
}: {
  transaction: TrendsListItemProps['transaction'];
}) {
  const {fromSeconds, toSeconds, showDigits} = transformDeltaSpread(
    transaction.aggregate_range_1,
    transaction.aggregate_range_2
  );

  return (
    <DurationChange>
      <Duration seconds={fromSeconds} fixedDigits={showDigits ? 1 : 0} abbreviation />
      <StyledIconArrow direction="right" size="xs" />
      <Duration seconds={toSeconds} fixedDigits={showDigits ? 1 : 0} abbreviation />
    </DurationChange>
  );
}

const DurationChange = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  margin: 0 ${space(1)};
`;

const StyledIconArrow = styled(IconArrow)`
  margin: 0 ${space(1)};
`;
