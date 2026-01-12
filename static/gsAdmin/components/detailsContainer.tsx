import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const DetailsContainer = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-template-columns: 1fr 1fr;
  align-items: start;

  h6 {
    margin-top: ${space(3)};
    margin-bottom: ${space(2)};
    padding-bottom: ${space(0.5)};
    text-transform: uppercase;
    font-size: ${p => p.theme.fontSize.md};
    color: ${p => p.theme.tokens.content.secondary};
    border-bottom: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

export default DetailsContainer;
