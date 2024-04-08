import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DOMAIN_STATUS_PAGE_URLS} from 'sentry/views/performance/http/domainStatusPageURLs';

interface Props {
  domain?: string;
}

export function DomainStatusLink({domain}: Props) {
  if (!domain) {
    return null;
  }

  return (
    <ExternalDomainLink href={DOMAIN_STATUS_PAGE_URLS[domain]}>
      {t('Status')}
      <IconOpen />
    </ExternalDomainLink>
  );
}

const ExternalDomainLink = styled(ExternalLink)`
  display: inline-flex;
  font-weight: 300;
  align-items: center;
  font-size: ${p => p.theme.fontSizeMedium};
  gap: ${space(1)};
`;
