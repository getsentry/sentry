import {Fragment} from 'react';

import Alert from 'sentry/components/alert';
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

export function ContinuousProfilingBetaBanner() {
  return (
    <Alert type="warning" showIcon>
      {t(
        'Continuous Profiling Beta is ending! We will begin to bill you for profiling usage after <date>.'
      )}
    </Alert>
  );
}
