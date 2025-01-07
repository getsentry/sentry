import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {useDiffCompareContext} from 'sentry/components/replays/diff/diffCompareContext';
import CrumbItem from 'sentry/components/replays/diff/picker/crumbItem';
import MutationOption from 'sentry/components/replays/diff/picker/mutationOption';
import {After, Before, DiffHeader} from 'sentry/components/replays/diff/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {isHydrateCrumb, isRRWebChangeFrame} from 'sentry/utils/replays/types';

const maxOptions = 3;

export default function DiffTimestampPicker() {
  const {
    frameOrEvent,
    leftOffsetMs,
    leftTimestampMs,
    replay,
    rightOffsetMs,
    rightTimestampMs,
    setLeftOffsetMs,
    setRightOffsetMs,
  } = useDiffCompareContext();

  const startTimestampMs = replay.getReplay().started_at.getTime() ?? 0;

  const {beforeOptions, afterOptions} = useMemo(() => {
    if (!isHydrateCrumb(frameOrEvent)) {
      return {beforeOptions: [], afterOptions: []};
    }
    const timestamp = frameOrEvent.timestamp.getTime();
    const rrwebFrames = replay.getRRWebFrames().filter(isRRWebChangeFrame);

    return {
      beforeOptions: rrwebFrames
        .filter(frame => frame.timestamp < timestamp)
        .slice(maxOptions * -1),
      afterOptions: rrwebFrames
        .filter(frame => frame.timestamp > timestamp)
        .slice(0, maxOptions),
    };
  }, [frameOrEvent, replay]);

  if (!isHydrateCrumb(frameOrEvent)) {
    return null;
  }

  return (
    <Fragment>
      <DiffHeader>
        <Before offset={leftOffsetMs} startTimestampMs={startTimestampMs} />
        <After offset={rightOffsetMs} startTimestampMs={startTimestampMs} />
      </DiffHeader>
      <Wrapper>
        <List>
          {beforeOptions.map((item, i) => (
            <ListItem key={i} data-before="true" data-selected={undefined}>
              <Tooltip title={t('Select this change as the Before moment')}>
                <MutationOption
                  key={i}
                  frame={item}
                  startTimestampMs={startTimestampMs}
                  radioName="left"
                  onChange={() => {
                    setLeftOffsetMs(item.timestamp - startTimestampMs);
                  }}
                  isChecked={item.timestamp === leftTimestampMs}
                />
              </Tooltip>
            </ListItem>
          ))}
        </List>

        <CrumbItem crumb={frameOrEvent} startTimestampMs={startTimestampMs} />

        <List>
          {afterOptions.map((item, i) => (
            <ListItem key={i} data-after="true" data-selected={undefined}>
              <Tooltip title={t('Select this change as the After moment')}>
                <MutationOption
                  key={i}
                  frame={item}
                  startTimestampMs={startTimestampMs}
                  radioName="right"
                  onChange={() => {
                    setRightOffsetMs(item.timestamp - startTimestampMs);
                  }}
                  isChecked={item.timestamp === rightTimestampMs}
                />
              </Tooltip>
            </ListItem>
          ))}
        </List>
      </Wrapper>
    </Fragment>
  );
}

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content ${space(4)} max-content;
  justify-content: center;
  margin-top: 1em; /* Reserve space for the CrumbItem title */
`;

const List = styled('ul')`
  display: flex;
  flex-direction: row;

  list-style: none;
  margin: 0;
  padding: 0;
  gap: ${space(1)};
`;

const ListItem = styled('li')`
  margin: 0;
  font-variant-numeric: tabular-nums;
  background-color: transparent;

  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid transparent;

  &[data-before='true'] {
    border-color: ${p => p.theme.red400};
  }
  &[data-after='true'] {
    border-color: ${p => p.theme.green400};
  }

  &[data-before='true']:hover,
  &[data-before='true'][data-selected='true'] {
    background-color: ${p => p.theme.red100};
  }
  &[data-after='true']:hover,
  &[data-after='true'][data-selected='true'] {
    background-color: ${p => p.theme.green100};
  }
`;
