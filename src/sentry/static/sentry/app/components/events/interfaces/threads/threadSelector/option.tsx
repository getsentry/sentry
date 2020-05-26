import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

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
  const {label = t('<unknown>'), filename = t('<unknown>')} = details;
  const optionName = name || t('<unknown>');
  return (
    <Grid>
      <GridCell>
        <Id>
          <Tooltip title={`#${id}`} position="top">
            <TextOverflow>{`#${id}`}</TextOverflow>
          </Tooltip>
        </Id>
      </GridCell>
      <GridCell>
        <Name>
          <Tooltip title={optionName} position="top">
            <TextOverflow>{optionName}</TextOverflow>
          </Tooltip>
        </Name>
      </GridCell>
      <GridCell>
        <Label>
          <Tooltip title={label} position="top">
            <TextOverflow>{label}</TextOverflow>
          </Tooltip>
        </Label>
      </GridCell>
      <GridCell>
        <FileName>
          <Tooltip title={filename} position="top">
            <TextOverflow>{filename}</TextOverflow>
          </Tooltip>
        </FileName>
      </GridCell>
      <GridCell>
        <Icon>
          {crashed ? (
            crashedInfo ? (
              <Tooltip
                title={`${tct('errored with [crashedInfo]', {
                  crashedInfo: crashedInfo.values[0].type,
                })}`}
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
        </Icon>
      </GridCell>
    </Grid>
  );
};

export {Option};

const centerCss = css`
  display: flex;
  align-items: center;
  height: 100%;
`;

const Label = styled('strong')`
  color: ${p => p.theme.blue};
  ${centerCss};
`;

const Id = styled('div')`
  ${centerCss};
`;

const Name = styled('div')`
  ${centerCss};
`;

const Icon = styled('div')`
  ${centerCss};
  justify-content: center;
`;

const FileName = styled('div')`
  color: ${p => p.theme.purple};
  ${centerCss};
`;
