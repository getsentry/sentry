import styled from '@emotion/styled';

import type {ThreadStates} from 'sentry/components/events/interfaces/threads/threadSelector/threadStates';
import {Tooltip} from 'sentry/components/tooltip';
import {IconFire} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {EntryData} from 'sentry/types/group';

import {Grid, GridCell} from './styles';

type Props = {
  details: ThreadInfo;
  hasThreadStates: boolean;
  id: number;
  crashed?: boolean;
  crashedInfo?: EntryData;
  name?: string | null;
};

type ThreadInfo = {
  filename?: string;
  label?: string;
  state?: ThreadStates;
};

function Option({id, details, name, crashed, crashedInfo, hasThreadStates}: Props) {
  const label = details.label ?? `<${t('unknown')}>`;
  const optionName = name || `<${t('unknown')}>`;

  return (
    <Grid hasThreadStates={hasThreadStates}>
      <GridCell>
        {crashed && (
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
      </GridCell>
      <GridCell>
        <Tooltip title={`#${id}`} position="top">
          <InnerCell>{`#${id}`}</InnerCell>
        </Tooltip>
      </GridCell>
      <GridCell>
        <Tooltip title={optionName} position="top" skipWrapper>
          <InnerCell isBold>{optionName}</InnerCell>
        </Tooltip>
      </GridCell>
      <GridCell>
        <Tooltip title={label} position="top" skipWrapper>
          <InnerCell>{label}</InnerCell>
        </Tooltip>
      </GridCell>
      {hasThreadStates && (
        <GridCell>
          <Tooltip title={details.state} position="top" skipWrapper>
            <InnerCell>{details.state}</InnerCell>
          </Tooltip>
        </GridCell>
      )}
    </Grid>
  );
}

export default Option;

const InnerCell = styled('div')<{
  isBold?: boolean;
  isCentered?: boolean;
}>`
  display: flex;
  align-items: center;
  justify-content: ${p => (p.isCentered ? 'center' : 'flex-start')};
  font-weight: ${p => (p.isBold ? 600 : 400)};
  ${p => p.theme.overflowEllipsis}
`;
