import styled from '@emotion/styled';
import Color from 'color';

import {Flex} from 'sentry/components/container/flex';
import {Alert} from 'sentry/components/core/alert';
import {NumberInput} from 'sentry/components/core/input/numberInput';
import {Tooltip} from 'sentry/components/core/tooltip';
import {OrderBy, SortBy} from 'sentry/components/events/featureFlags/utils';
import {IconSentry} from 'sentry/icons/iconSentry';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import toRoundedPercent from 'sentry/utils/number/toRoundedPercent';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import useGroupFlagDrawerData from 'sentry/views/issueDetails/groupFeatureFlags/useGroupFlagDrawerData';
import {TagBar} from 'sentry/views/issueDetails/groupTags/tagDistribution';

interface Props {
  debugSuspectScores: boolean;
  environments: string[];
  group: Group;
}

const SUSPECT_SCORE_LOCAL_STATE_KEY = 'flag-drawer-suspicion-score-threshold';
const SUSPECT_SCORE_THRESHOLD = 7;

export default function SuspectTable({debugSuspectScores, environments, group}: Props) {
  const [threshold, setThreshold] = useLocalStorageState(
    SUSPECT_SCORE_LOCAL_STATE_KEY,
    SUSPECT_SCORE_THRESHOLD
  );

  const {displayFlags, isPending} = useGroupFlagDrawerData({
    environments,
    group,
    orderBy: OrderBy.HIGH_TO_LOW,
    search: '',
    sortBy: SortBy.SUSPICION,
  });

  const debugThresholdInput = debugSuspectScores ? (
    <Flex gap={space(0.5)} align="center">
      <IconSentry size="xs" />
      Threshold:
      <NumberInput value={threshold} onChange={setThreshold} size="xs" />
    </Flex>
  ) : null;

  if (isPending) {
    return (
      <Alert type="muted">
        <TagHeader>
          {t('Suspect')}
          {debugThresholdInput}
        </TagHeader>
        {t('Loading...')}
      </Alert>
    );
  }

  const susFlags = displayFlags.filter(flag => (flag.suspect.score ?? 0) > threshold);

  if (!susFlags.length) {
    return (
      <Alert type="muted">
        <TagHeader>
          {t('Suspect')}
          {debugThresholdInput}
        </TagHeader>
        {t('Nothing suspicious')}
      </Alert>
    );
  }

  return (
    <Alert type="warning">
      <TagHeader>
        {t('Suspect')}
        {debugThresholdInput}
      </TagHeader>

      <TagValueGrid>
        {susFlags.map(flag => {
          const topValue = flag.topValues[0];

          const pct =
            topValue?.value === 'true'
              ? (flag.suspect.baselinePercent ?? 0)
              : 100 - (flag.suspect.baselinePercent ?? 0);
          const projPercentage = Math.round(pct * 100);
          const displayProjPercent =
            projPercentage < 1 ? '<1%' : `${projPercentage.toFixed(0)}%`;

          return (
            <TagValueRow key={flag.key}>
              {/* TODO: why is flag.name transformed to TitleCase? */}
              <Tooltip title={flag.key} showOnlyOnOverflow>
                <Name>{flag.key}</Name>
              </Tooltip>
              <TagBar percentage={((topValue?.count ?? 0) / flag.totalValues) * 100} />
              <RightAligned>
                {toRoundedPercent((topValue?.count ?? 0) / flag.totalValues)}
              </RightAligned>
              <span>{topValue?.value}</span>
              <Subtext>vs</Subtext>
              <RightAligned>
                <Subtext>{t('%s in project', displayProjPercent)}</Subtext>
              </RightAligned>
            </TagValueRow>
          );
        })}
      </TagValueGrid>
    </Alert>
  );
}

const TagHeader = styled('h5')`
  display: flex;
  justify-content: space-between;
  align-items: center;

  margin-bottom: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const progressBarWidth = '45px'; // Prevent percentages from overflowing
const TagValueGrid = styled('ul')`
  display: grid;
  grid-template-columns: 4fr ${progressBarWidth} auto auto max-content auto;

  margin: 0;
  padding: 0;
  list-style: none;
`;

const TagValueRow = styled('li')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  grid-column-gap: ${space(1)};
  align-items: center;
  padding: ${space(0.25)} ${space(0.75)};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.textColor};
  font-variant-numeric: tabular-nums;

  &:nth-child(2n) {
    background-color: ${p => Color(p.theme.gray300).alpha(0.1).toString()};
  }
`;

const Name = styled('div')`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
`;

const Subtext = styled('span')`
  color: ${p => p.theme.subText};
`;
const RightAligned = styled('span')`
  text-align: right;
`;
