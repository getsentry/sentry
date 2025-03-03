import styled from '@emotion/styled';

import ExternalLink from 'sentry/components/links/externalLink';
import {IconBusiness} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type Props = {
  color?: string;
  /**
   * To match power icon
   */
  iconSize?: string;
};

function MoreFeaturesLink({color, iconSize}: Props) {
  return (
    <MoreLink href="https://sentry.io/pricing" color={color}>
      <IconBusiness legacySize={iconSize} />
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
  color: ${p => p.color ?? p.theme.gray300};

  &:hover,
  &:focus,
  &:active {
    color: ${p => p.color ?? p.theme.textColor};
  }
`;

export default MoreFeaturesLink;
