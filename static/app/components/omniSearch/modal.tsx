import {useEffect} from 'react';
import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {OmniSearchPalette} from 'sentry/components/omniSearch/palette';
import {trackAnalytics} from 'sentry/utils/analytics';

function OmniSearchModal({Body}: ModalRenderProps) {
  useEffect(
    () =>
      trackAnalytics('omnisearch.open', {
        organization: null,
      }),
    []
  );

  return (
    <Body>
      <OmniSearchPalette />
    </Body>
  );
}

export default OmniSearchModal;

export const modalCss = css`
  [role='document'] {
    padding: 0;
  }
`;
