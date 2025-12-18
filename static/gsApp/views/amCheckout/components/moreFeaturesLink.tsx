import styled from '@emotion/styled';

import {ExternalLink} from 'sentry/components/core/link';
import {IconCheckmark} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = {
  color?: string;
  legacySize?: SVGIconProps['legacySize'];
};

function MoreFeaturesLink({color, legacySize}: Props) {
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
