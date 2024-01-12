import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import type {LinkProps} from 'sentry/components/links/link';
import Panel from 'sentry/components/panels/panel';

interface Props {
  buttonText: string;
  buttonTo: LinkProps['to'];
}

export const RELATED_ISSUES_BOOLEAN_QUERY_ERROR =
  'Error parsing search query: Boolean statements containing "OR" or "AND" are not supported in this search';

/**
 * Renders an Alert box of type "info" for boolean queries in alert details. Renders a discover link if the feature is available.
 */
export function RelatedIssuesNotAvailable({buttonTo, buttonText}: Props) {
  return (
    <StyledAlert
      type="info"
      showIcon
      trailingItems={
        <Feature features="discover-basic">
          <Button priority="default" size="xs" to={buttonTo}>
            {buttonText}
          </Button>
        </Feature>
      }
    >
      <div data-test-id="loading-error-message">
        Related Issues unavailable for this alert.
      </div>
    </StyledAlert>
  );
}

const StyledAlert = styled(Alert)`
  ${Panel} & {
    border-radius: 0;
    border-width: 1px 0;
  }
`;
