import {css} from '@emotion/react';

import {smallCss} from '../styles/typography';

export default function CountBadge({value}: {value: number}) {
  return <div css={[smallCss, counterCss]}>{value}</div>;
}

const counterCss = css`
  background: red;
  background: var(--red400);
  border-radius: 50%;
  color: var(--gray100);
  height: 1rem;
  line-height: 1rem;
  position: absolute;
  right: -6px;
  top: -6px;
  width: 1rem;
`;
