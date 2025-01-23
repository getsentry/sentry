import styled from '@emotion/styled';

type IconCircledNumberProps = {
  number: number;
};

export function IconCircledNumber({number}: IconCircledNumberProps) {
  // How do we make this accessible?
  return (
    <Circle>
      <Number>{number}</Number>
    </Circle>
  );
}

// Is there a way to make the size of the icon dynamic?
const Circle = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid;
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: bold;
  text-align: center;
  line-height: 1;
  box-sizing: border-box;
`;

const Number = styled('span')`
  display: block;
`;
