import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useStatusPageList} from 'sentry/views/performance/http/data/useStatusPageList';

interface Props {
  domain?: string;
}

export function DomainStatusLink({domain}: Props) {
  const statusPageList = useStatusPageList();

  if (!domain) {
    return null;
  }

  const statusPageURL = statusPageList?.domainToStatusPageUrls?.[domain];

  if (!statusPageURL) {
    return null;
  }

  return (
    <ExternalDomainLink href={statusPageURL}>
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
