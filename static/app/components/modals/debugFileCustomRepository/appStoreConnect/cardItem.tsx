import styled from '@emotion/styled';

import space from 'app/styles/space';

type Props = {
  label: string;
  value: string;
};

function CardItem({label, value}: Props) {
  return (
    <Wrapper>
      <strong>{`${label}:`}</strong>
      {value}
    </Wrapper>
  );
}

export default CardItem;

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1)};
`;
