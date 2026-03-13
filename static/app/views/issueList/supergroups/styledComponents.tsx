import styled from '@emotion/styled';

import {inlineCodeStyles} from '@sentry/scraps/code';

import {MarkedText} from 'sentry/utils/marked/markedText';

export const StyledMarkedText = styled(MarkedText)`
  code:not(pre code) {
    ${p => inlineCodeStyles(p.theme)};
  }
`;
