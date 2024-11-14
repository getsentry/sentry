import {Fragment} from 'react';

import {Button} from 'sentry/components/button';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {t} from 'sentry/locale';

export const ProfilingBetaAlertBanner = HookOrDefault({
  hookName: 'component:profiling-billing-banner',
});

export const ProfilingUpgradeButton = HookOrDefault({
  hookName: 'component:profiling-upgrade-plan-button',
  defaultComponent: ({children, ...props}) => <Button {...props}>{children}</Button>,
});

export const ProfilingAM1OrMMXUpgrade = HookOrDefault({
  hookName: 'component:profiling-am1-or-mmx-upgrade',
  defaultComponent: () => (
    <Fragment>
      <h3>{t('Function level insights')}</h3>
      <p>
        {t(
          'Discover slow-to-execute or resource intensive functions within your application'
        )}
      </p>
    </Fragment>
  ),
});
