import styled from '@emotion/styled';

import space from 'app/styles/space';

type Props = {
  caption: React.ReactNode;
};

function PaginationCaption({caption}: Props) {
  return <Wrapper>{caption}</Wrapper>;
}

export default PaginationCaption;

const Wrapper = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  margin-right: ${space(2)};
`;
