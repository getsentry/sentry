import styled from '@emotion/styled';

import space from 'app/styles/space';

type Props = {
  noMargin?: boolean;
};

const TextBlock = styled('div')<Props>`
  line-height: 1.5;
  ${p => (p.noMargin ? '' : 'margin-bottom:' + space(3))};
`;

export default TextBlock;
