import styled from '@emotion/styled';

import {ExternalLink} from 'sentry/components/core/link';
import {IconBusiness, IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {IconSize} from 'sentry/utils/theme/theme';

type Props = {
  color?: string;
  /**
   * To match power icon
   */
  iconSize?: string;
  isNewCheckout?: boolean;
};

function MoreFeaturesLink({color, iconSize, isNewCheckout}: Props) {
  return (
    <MoreLink href="https://sentry.io/pricing" color={color}>
      {isNewCheckout ? (
        <IconCheckmark size={(iconSize as IconSize) ?? 'sm'} />
      ) : (
        <IconBusiness legacySize={iconSize} />
      )}
      {t('And more...')}
    </MoreLink>
  );
}

const MoreLink = styled(ExternalLink)<{color?: string}>`
  display: grid;
  grid-template-columns: max-content auto;
  gap: ${space(1)};
  align-items: center;
  align-content: center;
  color: ${p => p.color ?? p.theme.subText};

  &:hover,
  &:focus,
  &:active {
    color: ${p => p.color ?? p.theme.tokens.content.primary};
  }
`;

export default MoreFeaturesLink;
