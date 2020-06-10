import React from 'react';
import styled from '@emotion/styled';

import {Color} from 'app/utils/theme';
import {t, tct} from 'app/locale';
import Tooltip from 'app/components/tooltip';
import TextOverflow from 'app/components/textOverflow';
import {EntryTypeData} from 'app/types';
import {IconFire, IconCheckmark} from 'app/icons';

import {Grid, GridCell} from './styles';

type Props = {
  id: string;
  details: ThreadInfo;
  crashedInfo?: EntryTypeData;
  name?: string | null;
  crashed?: boolean;
};

type ThreadInfo = {
  label?: string;
  filename?: string;
};

const Option = ({id, details, name, crashed, crashedInfo}: Props) => {
  const {label = `<${t('unknown')}>`, filename = `<${t('unknown')}>`} = details;
  const optionName = name || `<${t('unknown')}>`;

  return (
    <Grid>
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
        <InnerCell color="blue">
          <Tooltip title={label} position="top">
            <TextOverflow>{label}</TextOverflow>
          </Tooltip>
        </InnerCell>
      </GridCell>
      <GridCell>
        <InnerCell color="purple">
          <Tooltip title={filename} position="top">
            <TextOverflow>{filename}</TextOverflow>
          </Tooltip>
        </InnerCell>
      </GridCell>
      <GridCell>
        <InnerCell isCentered>
          {crashed ? (
            crashedInfo ? (
              <Tooltip
                title={tct('Errored with [crashedInfo]', {
                  crashedInfo: crashedInfo.values[0].type,
                })}
                position="top"
              >
                <IconFire color="red" />
              </Tooltip>
            ) : (
              <IconFire color="red" />
            )
          ) : (
            <IconCheckmark color="green" size="xs" />
          )}
        </InnerCell>
      </GridCell>
    </Grid>
  );
};

export default Option;

const InnerCell = styled('div')<{isCentered?: boolean; color?: Color; isBold?: boolean}>`
  display: flex;
  align-items: center;
  height: 100%;
  justify-content: ${p => (p.isCentered ? 'center' : 'flex-start')};
  font-weight: ${p => (p.isBold ? 600 : 400)};
  ${p => p.color && `color: ${p.theme[p.color]}`}
`;
