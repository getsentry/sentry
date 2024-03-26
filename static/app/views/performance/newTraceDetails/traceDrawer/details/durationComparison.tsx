import styled from '@emotion/styled';

import {Row} from 'sentry/components/events/interfaces/spans/newTraceDetailsSpanDetails';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getDuration} from 'sentry/utils/formatters';

type Props = {
  duration: number;
  title: string;
  avgDuration?: number;
  toolTipText?: string;
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

function DurationComparison(props: Props) {
  if (!props.avgDuration) {
    return (
      <Row title={props.title} toolTipText={props.toolTipText}>
        <Duration>{getDuration(props.duration, 2, true)}</Duration>
      </Row>
    );
  }

  const delta = props.duration - props.avgDuration;
  const deltaPct = `${Number(Math.abs((delta / props.avgDuration) * 100).toFixed(2))}%`;
  const formattedAvgDuration = getDuration(props.avgDuration, 2, true);
  const status = delta > 0 ? 'slower' : delta < 0 ? 'faster' : 'equal';

  const deltaText =
    status === 'equal'
      ? t(`Equal to avg %s`, deltaPct, formattedAvgDuration)
      : status === 'faster'
        ? t(`-%s faster than avg %s`, deltaPct, formattedAvgDuration)
        : t(`+%s slower than avg %s`, deltaPct, formattedAvgDuration);

  return (
    <Row title={props.title} toolTipText={props.toolTipText}>
      <Duration>{getDuration(props.duration, 2, true)}</Duration>(
      <Comparison status={status}>{deltaText}</Comparison>)
    </Row>
  );
}

const Duration = styled('span')`
  font-weight: bold;
  margin-right: ${space(1)};
`;

const Comparison = styled('span')<{status: 'faster' | 'slower' | 'equal'}>`
  color: ${p => p.theme[COLORS[p.status].normal]};
`;

export default DurationComparison;
