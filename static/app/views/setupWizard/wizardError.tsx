import styled from '@emotion/styled';

import {LoadingError} from 'sentry/components/loadingError';

/**
 * LoadingError's alert margin would stack on the wizard card's bottom padding.
 */
export const WizardError = styled(LoadingError)`
  && {
    margin-bottom: 0;
  }
`;
