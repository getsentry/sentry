import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {tct} from 'sentry/locale';

export default function DiffFeedbackBanner() {
  return (
    <StyledAlert type="info" showIcon>
      {tct(
        `The diff tools are based on a best-effort implementation to highlight the DOM state before and after a hydration event is thrown.
        React itself does not provide any details about what caused the problem; therefore, it's not 100% reliable, as sometimes no diff is found.
        Please see [link: this ticket] for more details and to share your feedback.`,
        {
          link: <ExternalLink href="https://github.com/getsentry/sentry/issues/80092" />,
        }
      )}
    </StyledAlert>
  );
}

export const StyledAlert = styled(Alert)`
  margin: 0;
`;
