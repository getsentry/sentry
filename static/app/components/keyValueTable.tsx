import * as React from 'react';
import styled from '@emotion/styled';

import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';

type Props = {
  keyName: React.ReactNode;
  value: React.ReactNode;
};

export const KeyValueTable = styled('dl')`
  display: grid;
  grid-template-columns: 50% 50%;
`;

export const KeyValueTableRow = ({keyName, value}: Props) => {
  return (
    <React.Fragment>
      <Key>{keyName}</Key>
      <Value>{value}</Value>
    </React.Fragment>
  );
};

const commonStyles = ({theme}: {theme: Theme}) => `
font-size: ${theme.fontSizeMedium};
padding: ${space(0.5)} ${space(1)};
font-weight: normal;
line-height: inherit;
${overflowEllipsis};
&:nth-of-type(2n-1) {
  background-color: ${theme.backgroundSecondary};
}
`;

const Key = styled('dt')`
  ${commonStyles};
  color: ${p => p.theme.textColor};
`;

const Value = styled('dd')`
  ${commonStyles};
  color: ${p => p.theme.subText};
  text-align: right;
`;
