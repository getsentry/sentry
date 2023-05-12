import styled from '@emotion/styled';

import {ThreadStates} from 'sentry/components/events/interfaces/threads/threadSelector/threadStates';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {IconFire} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {EntryData} from 'sentry/types';
import {ColorOrAlias} from 'sentry/utils/theme';

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
        <InnerCell>
          <Tooltip title={`#${id}`} position="top">
            <TextOverflow>{`#${id}`}</TextOverflow>
          </Tooltip>
        </InnerCell>
      </GridCell>
      <GridCell>
        <InnerCell isBold>
          <Tooltip title={optionName} position="top">
            <TextOverflow>{optionName}</TextOverflow>
          </Tooltip>
        </InnerCell>
      </GridCell>
      <GridCell>
        <InnerCell color="linkColor">
          <Tooltip title={label} position="top">
            <TextOverflow>{label}</TextOverflow>
          </Tooltip>
        </InnerCell>
      </GridCell>
      {hasThreadStates && (
        <GridCell>
          <InnerCell>
            <Tooltip title={details.state} position="top">
              <TextOverflow>{details.state}</TextOverflow>
            </Tooltip>
          </InnerCell>
        </GridCell>
      )}
    </Grid>
  );
}

export default Option;

const InnerCell = styled('div')<{
  color?: ColorOrAlias;
  isBold?: boolean;
  isCentered?: boolean;
}>`
  display: flex;
  align-items: center;
  justify-content: ${p => (p.isCentered ? 'center' : 'flex-start')};
  font-weight: ${p => (p.isBold ? 600 : 400)};
  ${p => p.color && `color: ${p.theme[p.color]}`}
`;
