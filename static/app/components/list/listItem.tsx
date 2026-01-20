import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {space} from 'sentry/styles/space';

export interface ListItemProps extends React.HTMLAttributes<HTMLLIElement> {
  padding?: string;
  ref?: React.Ref<HTMLLIElement>;
  symbol?: React.ReactElement;
}

const ListItem = styled(
  ({ref, symbol, children, padding: _padding, ...props}: ListItemProps) => (
    <li ref={ref} role={props.onClick ? 'button' : undefined} {...props}>
      {symbol && (
        <Flex align="center" minHeight="22.5px" position="absolute" top="0" left="0">
          {symbol}
        </Flex>
      )}
      {children}
    </li>
  )
)`
  position: relative;
  ${p => p.symbol && `padding-left: ${p.padding ?? space(4)};`}
`;

export default ListItem;
