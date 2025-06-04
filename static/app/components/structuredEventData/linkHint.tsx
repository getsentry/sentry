import styled from '@emotion/styled';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {isUrl} from 'sentry/utils/string/isUrl';

interface Props {
  value: string;
  meta?: Record<any, any>;
}

export default function LinkHint({meta, value}: Props) {
  if (!isUrl(value) || defined(meta)) {
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
