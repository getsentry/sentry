import styled from '@emotion/styled';

type IconCircledNumberProps = {
  number: number;
  size?: number;
};

export function IconCircledNumber({number, size = 20}: IconCircledNumberProps) {
  return (
    <Circle size={size} role="img" aria-label={`circled number ${number}`}>
      <Number size={size}>{number}</Number>
    </Circle>
  );
}

const Circle = styled('div')<{size: number}>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: ${p => p.size}px;
  height: ${p => p.size}px;
  border-radius: 50%;
  border: 2px solid;
  font-weight: bold;
  text-align: center;
  line-height: 1;
  box-sizing: border-box;
`;

const Number = styled('span')<{size: number}>`
  display: block;
  font-size: ${p => p.size / 2}px;
`;
