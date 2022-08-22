import {Fragment} from 'react';
import styled from '@emotion/styled';

import space from 'sentry/styles/space';
import {Theme} from 'sentry/utils/theme';

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
    <Fragment>
      <Key>{keyName}</Key>
      <Value>{value}</Value>
    </Fragment>
  );
};

const commonStyles = ({theme}: {theme: Theme}) => `
font-size: ${theme.fontSizeMedium};
padding: ${space(0.5)} ${space(1)};
font-weight: normal;
line-height: inherit;
${p => p.theme.overflowEllipsis};
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
