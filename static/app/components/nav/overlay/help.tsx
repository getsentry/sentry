import {Fragment, type MouseEventHandler, useCallback} from 'react';

import {openHelpSearchModal} from 'sentry/actionCreators/modal';
import {OverlayMenuLink} from 'sentry/components/nav/overlay';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

export default function Help() {
  const organization = useOrganization();

  const handleClick: MouseEventHandler<HTMLAnchorElement> = useCallback(
    event => {
      event.preventDefault();
      openHelpSearchModal({organization});
    },
    [organization]
  );

  return (
    <Fragment>
      <OverlayMenuLink to={{}} onClick={handleClick}>
        {t('Search Support, Docs and More')}
      </OverlayMenuLink>
      <OverlayMenuLink to="https://sentry.zendesk.com/hc/en-us">
        {t('Visit Help Center')}
      </OverlayMenuLink>
      <OverlayMenuLink to="https://discord.com/invite/sentry">
        {t('Join our Discord')}
      </OverlayMenuLink>
      <OverlayMenuLink to="mailto:support@sentry.io">
        {t('Contact Support')}
      </OverlayMenuLink>
    </Fragment>
  );
}
