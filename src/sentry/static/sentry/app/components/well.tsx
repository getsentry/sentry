import React from 'react';
import styled from 'react-emotion';
import PropTypes from 'prop-types';

type Props = {
  hasImage: boolean | undefined;
  centered: boolean | undefined;
  children: React.ReactNode;
  theme?: any;
};

type WellProps = Omit<React.HTMLProps<HTMLDivElement>, keyof Props> & Props;

const Well = styled('div')<WellProps>`
  border: 1px solid ${p => p.theme.borderLight};
  box-shadow: none;
  background: ${p => p.theme.whiteDark};
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
