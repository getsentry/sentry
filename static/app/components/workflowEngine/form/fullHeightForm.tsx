import styled from '@emotion/styled';

import {Form} from 'sentry/components/forms/form';

/**
 * Wraps the form content in a full height container with sticky footer.
 */
export const FullHeightForm = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1 0%;
  background-color: ${p => p.theme.tokens.background.primary};

  & > div:first-child {
    display: flex;
    flex-direction: column;
    flex: 1;
  }
`;

/**
 * Extends the Form component to be full height and have a sticky footer.
 *
 * Remove once all detector forms have migrated to the new form system.
 */
export const FullHeightFormDeprecated = styled(Form)`
  display: flex;
  flex-direction: column;
  flex: 1 1 0%;
  background-color: ${p => p.theme.tokens.background.primary};

  & > div:first-child {
    display: flex;
    flex-direction: column;
    flex: 1;
  }
`;
