import type React from 'react';
import {css} from '@emotion/react';

import {smallCss} from '../styles/typography';

const variants = {
  red: css`
    background: var(--red400);
    color: var(--gray100);
  `,
};

interface Props {
  icon: React.ReactNode;
  variant: keyof typeof variants;
}

export default function IndicatorBadge({icon, variant}: Props) {
  return <div css={[smallCss, counterCss, variants[variant]]}>{icon}</div>;
}

const counterCss = css`
  background: var(--red400);
  border-radius: 50%;
  border: 1px solid transparent;
  box-sizing: content-box;
  color: var(--gray100);
  height: 1rem;
  line-height: 1rem;
  position: absolute;
  right: -6px;
  top: -6px;
  width: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
`;
