import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

const Wrapper = styled('div')`
  max-width: 769px;
  max-height: 525px;
  margin-left: auto;
  margin-right: auto;
  padding: ${space(4)};
  background-color: ${p => p.theme.surface400};
  z-index: 100;
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.05);
  border-radius: 10px;
  width: 100%;
  color: ${p => p.theme.gray300};
  mark {
    border-radius: 8px;
    padding: ${space(0.25)} ${space(0.5)} ${space(0.25)} ${space(0.5)};
    background: ${p => p.theme.gray100};
    margin-right: ${space(1)};
  }
  h2 {
    color: ${p => p.theme.gray500};
  }
  p {
    margin: ${space(1)} ${space(0.5)};
  }
  svg {
    margin: ${space(0.5)};
  }
  .encrypt-help {
    color: ${p => p.theme.gray500};
  }
`;

export default Wrapper;
