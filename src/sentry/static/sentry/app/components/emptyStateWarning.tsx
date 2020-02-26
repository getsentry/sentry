import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import HeroIcon from 'app/components/heroIcon';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import {IconWarning} from 'app/icons';
import theme from 'app/utils/theme';
import space from 'app/styles/space';

type Props = {
  small?: boolean;
  children?: React.ReactNode;
};

const EmptyStateWarning = ({small = false, children}: Props) =>
  small ? (
    <EmptyMessage>
      <SmallMessage>
        <StyledIconWarning color={theme.gray2} size="lg" />
        {children}
      </SmallMessage>
    </EmptyMessage>
  ) : (
    <EmptyStreamWrapper data-test-id="empty-state">
      <HeroIcon src="icon-circle-exclamation" size="54" />
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

  ${HeroIcon} {
    margin-bottom: 20px;
  }
`;

const SmallMessage = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  line-height: 1em;
`;

const StyledIconWarning = styled(IconWarning)`
  margin-right: ${space(1)};
`;

export default EmptyStateWarning;
