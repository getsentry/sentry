import styled from '@emotion/styled';

import {slideInUp} from 'app/styles/animations';

const FieldErrorReason = styled('div')`
  color: ${p => p.theme.red500};
  position: absolute;
  right: 2px;
  margin-top: 6px;
  background: #fff;
  padding: 6px 8px;
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeSmall};
  border-radius: 3px;
  box-shadow: 0 0 0 1px rgba(64, 11, 54, 0.15), 0 4px 20px 0 rgba(64, 11, 54, 0.36);
  z-index: ${p => p.theme.zIndex.errorMessage};
  animation: ${slideInUp} 200ms ease-in-out forwards;

  &:before,
  &:after {
    content: '';
    border: 7px solid transparent;
    border-bottom-color: #fff;
    position: absolute;
    top: -14px;
    right: 9px;
  }

  &:before {
    margin-top: -1px;
    border-bottom-color: rgba(64, 11, 54, 0.15);
    filter: drop-shadow(0 -2px 5px rgba(64, 11, 54, 1));
  }
`;

export default FieldErrorReason;
