import type {ButtonHTMLAttributes, ReactNode} from 'react';
import {css, type Interpolation} from '@emotion/react';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';

import {resetButtonCss} from '../../styles/reset';
import {buttonCss} from '../../styles/typography';

const iconButtonCss = css`
  border: 1px solid transparent;
  background: none;
  color: white;
  padding: var(--space100) var(--space100);
  border-radius: var(--space100);
  gap: var(--space50);

  &:hover:not(:disabled) {
    border-color: white;
  }

  &[data-active-route='true'] {
    background: white;
    color: var(--gray400);
  }
`;

type BaseButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  css?: Interpolation<any>;
};

interface IconButtonProps extends BaseButtonProps {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  onClick?: () => void;
}

export default function IconButton({
  children,
  icon,
  onClick,
  title,
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={title}
      css={[resetButtonCss, buttonCss, iconButtonCss]}
      onClick={onClick}
      title={title}
      {...props}
    >
      <InteractionStateLayer />
      {icon}
      {children}
    </button>
  );
}
