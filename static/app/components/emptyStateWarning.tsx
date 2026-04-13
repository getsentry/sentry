import styled from '@emotion/styled';

import {EmptyMessage} from 'sentry/components/emptyMessage';
import {IconSearch} from 'sentry/icons';
import type {IconVariant} from 'sentry/icons/svgIcon';

type Props = {
  children?: React.ReactNode;
  className?: string;
  small?: boolean;
  variant?: IconVariant;
  withIcon?: boolean;
};

export function EmptyStateWarning({
  small = false,
  variant = 'muted',
  withIcon = true,
  children,
  className,
}: Props) {
  return small ? (
    <EmptyMessage className={className}>
      <SmallMessage>
        {withIcon && <StyledIconSearch variant={variant} size="lg" />}
        {children}
      </SmallMessage>
    </EmptyMessage>
  ) : (
    <EmptyStreamWrapper data-test-id="empty-state" className={className}>
      {withIcon && <IconSearch variant={variant} legacySize="54px" />}
      {children}
    </EmptyStreamWrapper>
  );
}

export const EmptyStreamWrapper = styled('div')`
  text-align: center;
  font-size: 22px;
  padding: ${p => p.theme.space['3xl']} ${p => p.theme.space.xl};

  p {
    line-height: 1.2;
    margin: 0 auto 20px;
    &:last-child {
      margin-bottom: 0;
    }
  }

  > svg {
    margin-bottom: ${p => p.theme.space.xl};
  }
`;

const SmallMessage = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.xl};
  line-height: 1em;
`;

const StyledIconSearch = styled(IconSearch)`
  margin-right: ${p => p.theme.space.md};
`;
