import styled from '@emotion/styled';

import {ExternalLink} from '@sentry/scraps/link';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {IconOpen} from 'sentry/icons';
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
    <ExternalLink
      onClick={e => {
        e.preventDefault();
        openNavigateToExternalLinkModal({linkText: value});
      }}
      role="link"
      className="external-icon"
    >
      <StyledIconOpen size="xs" aria-label={t('Open link')} />
    </ExternalLink>
  );
}

const StyledIconOpen = styled(IconOpen)`
  position: relative;
  top: 1px;
`;
