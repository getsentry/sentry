import {forwardRef, type HTMLAttributes, type ReactNode} from 'react';
import {css} from '@emotion/react';

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

type BaseButtonProps = HTMLAttributes<HTMLButtonElement>;

interface Props extends BaseButtonProps {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  onClick?: () => void;
}

export default forwardRef<HTMLButtonElement, Props>(function IconButton(
  {children, icon, onClick, title, ...props}: Props,
  forwardedRef
) {
  return (
    <button
      aria-label={title}
      css={[resetButtonCss, buttonCss, iconButtonCss]}
      onClick={onClick}
      ref={forwardedRef}
      {...props}
    >
      <InteractionStateLayer />
      {icon}
      {children}
    </button>
  );
});
