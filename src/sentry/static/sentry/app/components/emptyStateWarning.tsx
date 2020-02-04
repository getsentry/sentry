import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {IconWarning} from 'app/icons';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

type Props = {
  small?: boolean;
};

const EmptyStateWarning: React.FC<Props> = ({small, children}) =>
  small ? (
    <EmptyMessage icon={<IconWarning />}>
      <SmallMessage>{children}</SmallMessage>
    </EmptyMessage>
  ) : (
    <EmptyStreamWrapper data-test-id="empty-state">
      <IconWarning size="xl" />
      {children}
    </EmptyStreamWrapper>
  );

EmptyStateWarning.propTypes = {
  small: PropTypes.bool,
};

EmptyStateWarning.defaultProps = {
  small: false,
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
`;

const SmallMessage = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  line-height: 1em;
`;

export default EmptyStateWarning;
