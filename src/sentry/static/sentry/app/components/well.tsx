import * as React from 'react';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

type Props = {
  hasImage?: boolean;
  centered?: boolean;
  children: React.ReactNode;
  theme?: any;
};

type WellProps = Omit<React.HTMLProps<HTMLDivElement>, keyof Props> & Props;

const Well = styled('div')<WellProps>`
  border: 1px solid ${p => p.theme.borderLight};
  box-shadow: none;
  background: ${p => p.theme.gray100};
  padding: ${p => (p.hasImage ? '80px 30px' : '15px 20px')};
  margin-bottom: 20px;
  border-radius: 3px;
  ${p => p.centered && 'text-align: center'};
`;

Well.propTypes = {
  hasImage: PropTypes.bool,
  centered: PropTypes.bool,
};

export default Well;
