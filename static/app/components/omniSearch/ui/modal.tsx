import {useEffect} from 'react';
import {css} from '@emotion/react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {OmniSearchPalette} from 'sentry/components/omniSearch/ui/palette';
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
    <Body id="omni-search-modal">
      <OmniSearchPalette />
    </Body>
  );
}

export default OmniSearchModal;

export const modalCss = css`
  [role='document'] {
    padding: 0;
  }

  [role='document'].spinning {
    animation: omni-barrel-roll 1s ease-in-out;
  }

  @keyframes omni-barrel-roll {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
`;
