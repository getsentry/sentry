import {css} from '@emotion/react';

import {smallCss} from '../styles/typography';

const variants = {
  red: css`
    background: var(--red400);
    color: var(--gray100);
  `,
};

interface Props {
  variant: keyof typeof variants;
}

export default function IndicatorBadge({variant}: Props) {
  return <div css={[smallCss, badgeCss, variants[variant]]} />;
}

const badgeCss = css`
  background: var(--red400);
  border-radius: 50%;
  border: 1px solid transparent;
  box-sizing: content-box;
  color: var(--gray100);
  height: 0.55rem;
  line-height: 1rem;
  position: absolute;
  right: 2px;
  top: 18px;
  width: 0.55rem;
  display: flex;
  align-items: center;
  justify-content: center;
`;
