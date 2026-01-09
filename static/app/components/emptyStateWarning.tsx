import styled from '@emotion/styled';

import EmptyMessage from 'sentry/components/emptyMessage';
import {IconSearch} from 'sentry/icons';
import {space} from 'sentry/styles/space';

type Props = {
  children?: React.ReactNode;
  className?: string;
  small?: boolean;
  withIcon?: boolean;
};

function EmptyStateWarning({small = false, withIcon = true, children, className}: Props) {
  return small ? (
    <EmptyMessage className={className}>
      <SmallMessage>
        {withIcon && <StyledIconSearch variant="muted" size="lg" />}
        {children}
      </SmallMessage>
    </EmptyMessage>
  ) : (
    <EmptyStreamWrapper data-test-id="empty-state" className={className}>
      {withIcon && <IconSearch variant="muted" legacySize="54px" />}
      {children}
    </EmptyStreamWrapper>
  );
}

export const EmptyStreamWrapper = styled('div')`
  text-align: center;
  font-size: 22px;
  padding: ${space(4)} ${space(2)};

  p {
    line-height: 1.2;
    margin: 0 auto 20px;
    &:last-child {
      margin-bottom: 0;
    }
  }

  > svg {
    margin-bottom: ${space(2)};
  }
`;

const SmallMessage = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.xl};
  line-height: 1em;
`;

const StyledIconSearch = styled(IconSearch)`
  margin-right: ${space(1)};
`;

export default EmptyStateWarning;
