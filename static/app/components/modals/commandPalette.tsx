import {useEffect} from 'react';
import {css} from '@emotion/react';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {OmniSearchModal} from 'sentry/components/omniSearch/modal';
import {trackAnalytics} from 'sentry/utils/analytics';

function CommandPalette({Body}: ModalRenderProps) {
  useEffect(
    () =>
      void trackAnalytics('omnisearch.open', {
        organization: null,
      }),
    []
  );

  return (
    <Body>
      <OmniSearchModal />
    </Body>
  );
}

export default CommandPalette;

export const modalCss = css`
  padding: 0;
  [role='document'] {
    padding: 0;
  }
`;
