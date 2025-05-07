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
import FlagDetailsLink from 'sentry/views/issueDetails/groupFeatureFlags/details/flagDetailsLink';
import useGroupFlagDrawerData from 'sentry/views/issueDetails/groupFeatureFlags/hooks/useGroupFlagDrawerData';
import useSuspectFlagScoreThreshold from 'sentry/views/issueDetails/suspect/useSuspectFlagScoreThreshold';

interface Props {
  debugSuspectScores: boolean;
  environments: string[];
  group: Group;
}

export default function SuspectTable({debugSuspectScores, environments, group}: Props) {
  const [threshold, setThreshold] = useSuspectFlagScoreThreshold();

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
    <GradientBox>
      <TagHeader>
        {t('Suspect Flags')}
        {debugThresholdInput}
      </TagHeader>

      <TagValueGrid>
        {susFlags.map(flag => {
          const topValue = flag.topValues[0];

          return (
            <TagValueRow key={flag.key}>
              {/* TODO: why is flag.name transformed to TitleCase? */}
              <FlagDetailsLink flag={flag}>
                <Tooltip
                  title={flag.key}
                  showOnlyOnOverflow
                  data-underline-on-hover="true"
                >
                  {flag.key}
                </Tooltip>
              </FlagDetailsLink>
              <RightAligned>
                {toRoundedPercent((topValue?.count ?? 0) / flag.totalValues)}
              </RightAligned>
              <span>{topValue?.value}</span>
            </TagValueRow>
          );
        })}
      </TagValueGrid>
    </GradientBox>
  );
}

const GradientBox = styled('div')`
  border: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.background};
  background: linear-gradient(
    90deg,
    ${p => p.theme.backgroundSecondary}00 0%,
    ${p => p.theme.backgroundSecondary}FF 70%,
    ${p => p.theme.backgroundSecondary}FF 100%
  );
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.textColor};
  padding: ${space(1)};
`;

const TagHeader = styled('h4')`
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

const RightAligned = styled('span')`
  text-align: right;
`;
