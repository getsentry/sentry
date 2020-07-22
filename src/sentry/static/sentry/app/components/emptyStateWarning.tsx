import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import EmptyMessage from 'app/views/settings/components/emptyMessage';
import {IconSearch} from 'app/icons';
import space from 'app/styles/space';

type Props = {
  small?: boolean;
  children?: React.ReactNode;
  withIcon?: boolean;
  className?: string;
};

const EmptyStateWarning = ({
  small = false,
  withIcon = true,
  children,
  className,
}: Props) =>
  small ? (
    <EmptyMessage className={className}>
      <SmallMessage>
        {withIcon && <StyledIconSearch color="gray500" size="lg" />}
        {children}
      </SmallMessage>
    </EmptyMessage>
  ) : (
    <EmptyStreamWrapper data-test-id="empty-state" className={className}>
      {withIcon && <IconSearch size="54px" />}
      {children}
    </EmptyStreamWrapper>
  );

EmptyStateWarning.propTypes = {
  small: PropTypes.bool,
};

const EmptyStreamWrapper = styled('div')`
  text-align: center;
  font-size: 22px;
  padding: 48px 0;

  p {
    line-height: 1.2;
    margin: 0 auto 20px;
    &:last-child {
      margin-bottom: 0;
    }
  }

  svg {
    fill: ${p => p.theme.gray400};
    margin-bottom: ${space(2)};
  }
`;

const SmallMessage = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.gray500};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  line-height: 1em;
`;

const StyledIconSearch = styled(IconSearch)`
  margin-right: ${space(1)};
`;

export default EmptyStateWarning;
