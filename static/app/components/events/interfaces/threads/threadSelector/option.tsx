import styled from '@emotion/styled';

import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {IconFire} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Thread} from 'sentry/types/event';
import type {EntryData} from 'sentry/types/group';

import {ThreadSelectorGrid} from './styles';
import type {ThreadStates} from './threadStates';

type Props = {
  crashedInfo: EntryData | undefined;
  details: ThreadInfo;
  hasThreadStates: boolean;
  thread: Thread;
};

type ThreadInfo = {
  filename?: string;
  label?: string;
  state?: ThreadStates;
};

function Option({thread, crashedInfo, details, hasThreadStates}: Props) {
  const label = details.label ?? `<${t('unknown')}>`;
  const optionName = thread.name || `<${t('unknown')}>`;

  return (
    <ThreadSelectorGrid hasThreadStates={hasThreadStates}>
      <div>
        {thread.crashed && (
          <InnerCell isCentered>
            {crashedInfo ? (
              <Tooltip
                skipWrapper
                title={tct('Errored with [crashedInfo]', {
                  crashedInfo: crashedInfo.values[0].type,
                })}
                disabled={!crashedInfo}
                position="top"
              >
                <IconFire color="errorText" />
              </Tooltip>
            ) : (
              <IconFire color="errorText" />
            )}
          </InnerCell>
        )}
      </div>
      <InnerCell>
        <Tooltip title={`#${thread.id}`} position="top">
          <TextOverflow>{`#${thread.id}`}</TextOverflow>
        </Tooltip>
      </InnerCell>
      <InnerCell isBold>
        <Tooltip title={optionName} position="top">
          <TextOverflow>{optionName}</TextOverflow>
        </Tooltip>
      </InnerCell>
      <InnerCell>
        <Tooltip title={label} position="top">
          <TextOverflow>{label}</TextOverflow>
        </Tooltip>
      </InnerCell>
      {hasThreadStates && (
        <InnerCell>
          <Tooltip title={details.state} position="top">
            <TextOverflow>{details.state}</TextOverflow>
          </Tooltip>
        </InnerCell>
      )}
    </ThreadSelectorGrid>
  );
}

export default Option;

const InnerCell = styled('div')<{
  isBold?: boolean;
  isCentered?: boolean;
}>`
  ${p => p.theme.overflowEllipsis}
  display: flex;
  align-items: center;
  justify-content: ${p => (p.isCentered ? 'center' : 'flex-start')};
  font-weight: ${p => (p.isBold ? 600 : 400)};
`;
