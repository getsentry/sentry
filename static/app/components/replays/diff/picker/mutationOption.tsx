import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import Radio from 'sentry/components/radio';
import {IconClock} from 'sentry/icons/iconClock';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import formatDuration from 'sentry/utils/duration/formatDuration';
import {EventType, type RecordingFrame} from 'sentry/utils/replays/types';

interface Props {
  frame: RecordingFrame;
  isChecked: boolean;
  onChange: (e: React.FormEvent<HTMLInputElement>) => void;
  radioName: string;
  startTimestampMs: number;
}

export default function MutationOption({
  frame,
  startTimestampMs,
  isChecked,
  onChange,
  radioName,
}: Props) {
  const name = frame.type === EventType.FullSnapshot ? t('Full') : t('Incremental');

  const formattedDuration = formatDuration({
    duration: [frame.timestamp - startTimestampMs, 'ms'],
    precision: 'ms',
    style: 'hh:mm:ss.sss',
  });

  const id = `mutation-${formattedDuration}`;

  return (
    <Label htmlFor={id}>
      <Flex column gap={space(0.5)} align="center">
        <Flex gap={space(0.75)} align="center">
          <IconClock color="gray500" size="sm" />
          <span>{formattedDuration}</span>
        </Flex>
        <span>{name}</span>
        <Radio
          id={id}
          aria-label={formattedDuration}
          checked={isChecked}
          name={radioName}
          value={frame.timestamp - startTimestampMs}
          onChange={onChange}
        />
      </Flex>
    </Label>
  );
}

const Label = styled('label')`
  cursor: pointer;
  padding: ${space(1)};
  font-weight: normal;
  text-align: left;
`;
