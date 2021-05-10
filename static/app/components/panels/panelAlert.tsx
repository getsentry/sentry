import * as React from 'react';
import styled from '@emotion/styled';

import Alert from 'app/components/alert';
import {IconCheckmark, IconClose, IconFlag, IconInfo} from 'app/icons';
import space from 'app/styles/space';

type Props = React.ComponentProps<typeof Alert>;

const DEFAULT_ICONS = {
  info: <IconInfo size="md" />,
  error: <IconClose isCircled size="md" />,
  warning: <IconFlag size="md" />,
  success: <IconCheckmark isCircled size="md" />,
};

// Margin bottom should probably be a different prop
const PanelAlert = styled(({icon, ...props}: Props) => (
  <Alert {...props} icon={icon || DEFAULT_ICONS[props.type!]} system />
))`
  margin: 0 0 1px 0;
  padding: ${space(2)};
  border-radius: 0;
  box-shadow: none;

  &:last-child {
    border-bottom: none;
    margin: 0;
    border-radius: 0 0 4px 4px;
  }
`;

export default PanelAlert;
