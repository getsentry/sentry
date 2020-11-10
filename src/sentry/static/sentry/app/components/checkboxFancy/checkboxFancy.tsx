import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {Theme} from 'app/utils/theme';

import CheckboxFancyContent from './checkboxFancyContent';

type Props = {
  isDisabled?: boolean;
  size?: string;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
} & React.ComponentProps<typeof CheckboxFancyContent>;

const disabledStyles = (p: Props & {theme: Theme}) =>
  p.isDisabled &&
  css`
    background: ${p.isChecked || p.isIndeterminate ? p.theme.gray400 : p.theme.gray100};
    border-color: ${p.theme.border};
  `;

const hoverStyles = (p: Props & {theme: Theme}) =>
  !p.isDisabled &&
  css`
    border: 2px solid
      ${p.isChecked || p.isIndeterminate ? p.theme.purple300 : p.theme.gray700};
  `;

const CheckboxFancy = styled(
  ({isChecked, className, isDisabled, isIndeterminate, onClick}: Props) => (
    <div
      data-test-id="checkbox-fancy"
      role="checkbox"
      aria-disabled={isDisabled}
      aria-checked={isChecked}
      className={className}
      onClick={onClick}
    >
      <CheckboxFancyContent isIndeterminate={isIndeterminate} isChecked={isChecked} />
    </div>
  )
)`
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 1px 1px 5px 0px rgba(0, 0, 0, 0.05) inset;
  width: ${p => p.size};
  height: ${p => p.size};
  border-radius: 5px;
  background: ${p =>
    p.isChecked || p.isIndeterminate ? p.theme.purple300 : 'transparent'};
  border: 2px solid
    ${p => (p.isChecked || p.isIndeterminate ? p.theme.purple300 : p.theme.gray500)};
  cursor: ${p => (p.isDisabled ? 'not-allowed' : 'pointer')};
  ${p => (!p.isChecked || !p.isIndeterminate) && 'transition: 500ms border ease-out'};

  &:hover {
    ${hoverStyles}
  }

  ${disabledStyles}
`;

CheckboxFancy.defaultProps = {
  size: '16px',
  isChecked: false,
  isIndeterminate: false,
};

export default CheckboxFancy;
