import styled from '@emotion/styled';
import {IconOpen} from '@sentry/icons/open';

import {ExternalLink} from '@sentry/scraps/link';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {isValidUrl} from 'sentry/utils/string/isValidUrl';

interface Props {
  value: string;
  meta?: Record<any, any>;
}

export function LinkHint({meta, value}: Props) {
  if (!isValidUrl(value) || defined(meta)) {
    return null;
  }

  return (
    <StyledExternalLink
      onClick={e => {
        e.preventDefault();
        openNavigateToExternalLinkModal({linkText: value});
      }}
      role="link"
    >
      <StyledIconOpen size="xs" aria-label={t('Open link')} />
    </StyledExternalLink>
  );
}

const StyledExternalLink = styled(ExternalLink)`
  margin: 0 ${p => p.theme.space.xs};
  font-size: ${p => p.theme.font.size.xs};
  line-height: 1;
  vertical-align: middle;
`;

const StyledIconOpen = styled(IconOpen)`
  position: relative;
  top: 1px;
`;
