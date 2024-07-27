import {css} from '@emotion/react';

import {smallCss} from '../styles/typography';

/**
 * If you want more variants/colors then add to this record:
 */
const variants = {
  red: css`
    background: var(--red400);
    color: var(--gray100);
  `,
};

interface Props {
  value: number;
  variant: keyof typeof variants;
}

export default function CountBadge({value, variant}: Props) {
  return <div css={[smallCss, counterCss, variants[variant]]}>{value}</div>;
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
`;
