import styled from '@emotion/styled';

import space from 'app/styles/space';

const Sample = styled('div')`
  border-radius: ${p => p.theme.borderRadius};
  border: dashed 1px ${p => p.theme.border};
  padding: ${space(1)} ${space(2)};
  margin: ${space(2)} 0;

  & > *:first-of-type {
    margin-top: 0;
  }

  & > *:last-of-type {
    margin-bottom: 0;
  }
`;

export default Sample;
