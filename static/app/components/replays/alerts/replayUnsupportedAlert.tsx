import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';

interface Props {
  projectSlug: string;
}

export default function ReplayUnsupportedAlert({projectSlug}: Props) {
  const docsLink = (
    <ExternalLink href="https://docs.sentry.io/product/session-replay/getting-started/#supported-sdks" />
  );
  return (
    <StyledAlert type="info" icon={<IconInfo />}>
      <strong>{t(`Session Replay isn't available for %s.`, projectSlug)}</strong>{' '}
      {tct(`[docsLink: See our docs] to find out which platforms are supported.`, {
        docsLink,
      })}
    </StyledAlert>
  );
}

const StyledAlert = styled(Alert)`
  margin: 0;
`;
