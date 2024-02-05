import {forwardRef} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export interface ListItemProps extends React.HTMLAttributes<HTMLLIElement> {
  padding?: string;
  symbol?: React.ReactElement;
}

const ListItem = styled(
  forwardRef<HTMLLIElement, ListItemProps>(
    ({symbol, children, padding: _padding, ...props}, ref) => (
      <li ref={ref} role={props.onClick ? 'button' : undefined} {...props}>
        {symbol && <Symbol>{symbol}</Symbol>}
        {children}
      </li>
    )
  )
)`
  position: relative;
  display: flex;
  align-items: center;
  gap: ${space(2)};
`;

const Symbol = styled('div')`
display: flex;
align-items: center;
left: 0;
`;

export default ListItem;
