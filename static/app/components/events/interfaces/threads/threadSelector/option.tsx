import styled from '@emotion/styled';
import {IconFire} from '@sentry/icons/fire';

import {Flex, Grid} from '@sentry/scraps/layout';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Tooltip} from '@sentry/scraps/tooltip';

import {TextOverflow} from 'sentry/components/textOverflow';
import {t, tct} from 'sentry/locale';
import type {Thread} from 'sentry/types/event';
import type {EntryData} from 'sentry/types/group';

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

export function getThreadSelectorColumns(
  hasThreadStates: boolean
): Array<TableColumnConfig & {width: string}> {
  return [
    {key: 'crashed', width: '16px'},
    {key: 'id', width: 'minmax(44px, 0.5fr)'},
    {key: 'name', width: '1fr'},
    {key: 'label', width: '1fr'},
    ...(hasThreadStates ? [{key: 'state', width: '1fr'}] : []),
  ];
}

export function Option({thread, crashedInfo, details, hasThreadStates}: Props) {
  const label = details.label ?? `<${t('unknown')}>`;
  const optionName = thread.name || `<${t('unknown')}>`;

  return (
    <Grid
      align="center"
      columns={getThreadSelectorColumns(hasThreadStates)
        .map(column => column.width)
        .join(' ')}
      minHeight="18px"
    >
      <Flex justify="center">
        {thread.crashed &&
          (crashedInfo ? (
            <Tooltip
              skipWrapper
              title={tct('Errored with [crashedInfo]', {
                crashedInfo: crashedInfo.values[0].type,
              })}
              disabled={!crashedInfo}
              position="top"
            >
              <IconFire variant="danger" />
            </Tooltip>
          ) : (
            <IconFire variant="danger" />
          ))}
      </Flex>
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
    </Grid>
  );
}

const InnerCell = styled('div')<{isBold?: boolean}>`
  width: 100%;
  padding: 0 ${p => p.theme.space.md};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => (p.isBold ? 600 : 400)};
`;
