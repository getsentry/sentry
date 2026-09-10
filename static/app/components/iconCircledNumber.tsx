import styled from '@emotion/styled';

import {SvgIcon} from 'sentry/icons/svgIcon';

type IconCircledNumberProps = {
  number: number;
};

export function IconCircledNumber({number}: IconCircledNumberProps) {
  const size = SvgIcon.ICON_SIZES.md;
  return (
    <Circle role="img" size={size} aria-label={`circled number ${number}`}>
      <Number size={size}>{number}</Number>
    </Circle>
  );
}

const Circle = styled('div')<{size: string}>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: ${p => p.size};
  height: ${p => p.size};
  border-radius: 50%;
  border: 2px solid;
  font-weight: bold;
  text-align: center;
  line-height: 1;
  box-sizing: border-box;
`;

const Number = styled('span')<{size: string}>`
  display: block;
  font-size: calc(${p => p.size} / 2);
`;
