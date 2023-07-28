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
  ${p => p.symbol && `padding-left: ${p.padding ?? space(4)};`}
`;

const Symbol = styled('div')`
  display: flex;
  align-items: center;
  position: absolute;
  top: 0;
  left: 0;
  min-height: 22.5px;
`;

export default ListItem;
