import styled from '@emotion/styled';

import {ExternalLink} from '@sentry/scraps/link';

import {IconCheckmark} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';

type Props = {
  color?: string;
  legacySize?: SVGIconProps['legacySize'];
};

export function MoreFeaturesLink({color, legacySize}: Props) {
  return (
    <MoreLink href="https://sentry.io/pricing" color={color}>
      <IconCheckmark legacySize={legacySize} />

      {t('And more...')}
    </MoreLink>
  );
}

const MoreLink = styled(ExternalLink)<{color?: string}>`
  display: grid;
  grid-template-columns: max-content auto;
  gap: ${p => p.theme.space.md};
  align-items: center;
  align-content: center;
  color: ${p => p.color ?? p.theme.tokens.content.secondary};

  &:hover,
  &:focus,
  &:active {
    color: ${p => p.color ?? p.theme.tokens.content.primary};
  }
`;
