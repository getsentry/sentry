import styled from '@emotion/styled';

import Form from 'sentry/components/forms/form';

/**
 * Extends the Form component to be full height and have a sticky footer.
 */
export const FullHeightForm = styled(Form)`
  display: flex;
  flex-direction: column;
  flex: 1 1 0%;

  & > div:first-child {
    display: flex;
    flex-direction: column;
    flex: 1;
  }
`;
