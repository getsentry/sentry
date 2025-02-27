import ExternalLink from 'sentry/components/links/externalLink';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';

import {getCodecovJwtLink, useCodecovJwt} from 'getsentry/utils/useCodecovJwt';

export function CodecovSettingsLink({organization}: {organization: Organization}) {
  const {data: jwtData, isError} = useCodecovJwt(organization.slug);

  if (isError) {
    return null;
  }

  const codecovLink = getCodecovJwtLink('sentry-app-stacktracelink', jwtData);
  return (
    <ExternalLink href={codecovLink} disabled={!codecovLink}>
      {t('Learn More')}
    </ExternalLink>
  );
}
