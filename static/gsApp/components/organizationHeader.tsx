import {Fragment} from 'react';
import {css, Global} from '@emotion/react';

import type {Organization} from 'sentry/types/organization';

import GSBanner from 'getsentry/components/gsBanner';

/**
 * Pendo gives embedded guides a fixed pixel height when they render and only
 * re-measures overlay guides on window resize. The content area can narrow
 * without a window resize (e.g. when the Seer sidebar is expanded), so wrapped
 * text in embedded guides would overflow their container. Overlay guides are
 * mounted on <body>, so scoping to #main only affects embedded guides.
 */
const pendoEmbeddedGuideStyles = css`
  #main [id^='pendo-g-'] {
    height: auto !important;
  }
`;

interface Props {
  organization: Organization;
}

export function OrganizationHeader({organization}: Props) {
  return (
    <Fragment>
      <Global styles={pendoEmbeddedGuideStyles} />
      <GSBanner organization={organization} />
    </Fragment>
  );
}
