import {useEffect} from 'react';
import {css} from '@emotion/react';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {OmniSearchModal} from 'sentry/components/omniSearch/modal';
import {trackAnalytics} from 'sentry/utils/analytics';

function CommandPalette(props: ModalRenderProps) {
  useEffect(
    () =>
      void trackAnalytics('omnisearch.open', {
        organization: null,
      }),
    []
  );

  return <OmniSearchModal {...props} />;
}

export default CommandPalette;

export const modalCss = css`
  padding: 0;
  [role='document'] {
    padding: 0;
  }
`;
