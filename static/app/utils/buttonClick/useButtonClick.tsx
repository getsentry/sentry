import {useCallback, useContext} from 'react';

import {ButtonProps} from 'sentry/components/button';
import HookStore from 'sentry/stores/hookStore';
import {useRoutes} from 'sentry/utils/useRoutes';
import {OrganizationContext} from 'sentry/views/organizationContext';

type Props = ButtonProps;

export const trackButtonClick = HookStore.get('analytics:track-button-clicks')[0];

export default function useButtonClick({
  disabled,
  busy,
  onClick,
  analyticsEventName,
  analyticsEventKey,
  priority,
  href,
  analyticsParams,
  'aria-label': ariaLabel,
}: Props) {
  const organization = useContext(OrganizationContext);
  const routes = useRoutes();

  const buttonClick = useCallback(
    (e: React.MouseEvent) => {
      // Don't allow clicks when disabled or busy
      if (disabled || busy) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (typeof onClick !== 'function') {
        return;
      }

      if (organization) {
        trackButtonClick({
          eventName: analyticsEventName,
          eventKey: analyticsEventKey,
          organization,
          routes,
          data: {
            priority,
            text: ariaLabel,
            link: href,
            ...analyticsParams,
          },
        });
      }

      onClick(e);
    },
    [
      onClick,
      busy,
      disabled,
      href,
      analyticsEventName,
      analyticsEventKey,
      organization,
      priority,
      routes,
      analyticsParams,
      ariaLabel,
    ]
  );

  return buttonClick;
}
