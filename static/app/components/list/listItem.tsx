import styled from '@emotion/styled';

import space from 'sentry/styles/space';

type Props = {
  'aria-label'?: string;
  children?: React.ReactNode;
  className?: string;
  'data-test-id'?: string;
  onClick?: (event: React.MouseEvent) => void;
  symbol?: React.ReactElement;
};

const ListItem = styled(
  ({
    children,
    className,
    symbol,
    onClick,
    'aria-label': ariaLabel,
    'data-test-id': dataTestId,
  }: Props) => (
    <li
      className={className}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      aria-label={onClick ? ariaLabel : undefined}
      data-test-id={dataTestId}
    >
      {symbol && <Symbol>{symbol}</Symbol>}
      {children}
    </li>
  )
)`
  position: relative;
  ${p => p.symbol && `padding-left: ${space(4)};`}
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
