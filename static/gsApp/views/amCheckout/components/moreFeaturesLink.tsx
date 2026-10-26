import styled from '@emotion/styled';
import {IconCheckmark} from '@sentry/icons/checkmark';

import {ExternalLink} from '@sentry/scraps/link';

import {t} from 'sentry/locale';

export function MoreFeaturesLink() {
  return (
    <MoreLink href="https://sentry.io/pricing">
      <IconCheckmark />

      {t('And more...')}
    </MoreLink>
  );
}

const MoreLink = styled(ExternalLink)`
  display: grid;
  grid-template-columns: max-content auto;
  gap: ${p => p.theme.space.md};
  align-items: center;
  align-content: center;
  color: ${p => p.theme.tokens.content.secondary};

  &:hover,
  &:focus,
  &:active {
    color: ${p => p.theme.tokens.content.primary};
  }
`;
