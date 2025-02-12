import styled from '@emotion/styled';

type Props = {
  items: React.ReactElement[];
  className?: string;
};

function List({items, className}: Props) {
  if (!items.length) {
    return null;
  }

  return <Wrapper className={className}>{items}</Wrapper>;
}

export default List;

const Wrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  font-size: ${p => p.theme.fontSizeSmall};
`;
