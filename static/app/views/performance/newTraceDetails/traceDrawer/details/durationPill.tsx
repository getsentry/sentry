import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getDuration} from 'sentry/utils/formatters';

type Props = {
  avgDuration: number;
  duration: number;
};

export const COLORS = {
  faster: {
    light: 'green100',
    normal: 'green300',
  },
  slower: {
    light: 'red100',
    normal: 'red300',
  },
  equal: {
    light: 'gray100',
    normal: 'gray300',
  },
};

function DurationPill(props: Props) {
  const delta = props.duration - props.avgDuration;
  const deltaPct = `${Number(Math.abs((delta / props.avgDuration) * 100).toFixed(0))}%`;
  const formattedAvgDuration = getDuration(props.avgDuration, 2, true);
  const status = delta > 0 ? 'faster' : delta < 0 ? 'slower' : 'equal';
  const deltaText =
    status === 'equal'
      ? t(`%s avg %s`, deltaPct, formattedAvgDuration)
      : status === 'faster'
        ? t(`+%s faster than avg %s`, deltaPct, formattedAvgDuration)
        : t(`-%s slower than avg %s`, deltaPct, formattedAvgDuration);

  return (
    <Wrapper>
      <Duration>{getDuration(props.duration, 2, true)}</Duration>
      <Delta status={status}>{deltaText}</Delta>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: flex;
  align-items: center;
  height: 32px;
  max-width: 200px;
`;

const Duration = styled('div')`
  flex: 1;
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  justify-content: center;
  font-weight: bold;
  font-size: 16px;
  padding: ${space(0.5)};
  border-radius: ${p => p.theme.borderRadius} 0 0 ${p => p.theme.borderRadius};
  border: solid 1px ${p => p.theme.border};
  border-right: none;
  height: 100%;
`;

const Delta = styled('div')<{status: 'faster' | 'slower' | 'equal'}>`
  flex: 2;
  font-size: 10px;
  display: flex;
  align-items: center;
  text-align: center;
  justify-content: center;
  padding: ${space(0.5)};
  border-radius: 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0;
  background-color: ${p => p.theme[COLORS[p.status].light]};
  border: solid 1px ${p => p.theme[COLORS[p.status].normal]};
  color: ${p => p.theme[COLORS[p.status].normal]};
  height: 100%;
`;

export default DurationPill;
