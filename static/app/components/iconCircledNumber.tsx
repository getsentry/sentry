import styled from '@emotion/styled';

import {SvgIcon, type SVGIconProps} from 'sentry/icons/svgIcon';

type IconCircledNumberProps = {
  number: number;
  size?: SVGIconProps['size'];
};

export function IconCircledNumber({number, size = 'md'}: IconCircledNumberProps) {
  return (
    <Circle
      role="img"
      size={SvgIcon.ICON_SIZES[size]}
      aria-label={`circled number ${number}`}
    >
      <Number size={SvgIcon.ICON_SIZES[size]}>{number}</Number>
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
