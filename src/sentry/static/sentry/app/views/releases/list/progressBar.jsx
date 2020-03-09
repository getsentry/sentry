import React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

const ProgressBar = props => (
  <StyledBar>
    <StyledSlider width={props.width} />
  </StyledBar>
);
ProgressBar.propTypes = {
  width: PropTypes.number,
};

const StyledBar = styled('div')`
  background: #767676;
  width: 100%;
  height: 15px;
  float: right;
  margin-right: 0px;
  margin-bottom: 10px;
  border-radius: 20px;
  position: relative;
`;

const StyledSlider = styled('div')`
  height: 100%;
  width: ${props => (props.width ? props.width : 50)}%;
  background: #7ccca5;
  padding-right: 0;
  border-radius: inherit;
  box-shadow: 0 2px 1px rgba(0, 0, 0, 0.08);
  position: absolute;
  bottom: 0;
  left: 0;
`;

export default ProgressBar;
