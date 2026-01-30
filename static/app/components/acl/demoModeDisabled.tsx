import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {isDemoModeActive} from 'sentry/utils/demoMode';

type Props = {
  children?: React.ReactNode;
};

function DisableInDemoMode({children}: Props) {
  if (!isDemoModeActive()) {
    return children;
  }

  return (
    <Tooltip title={t('This action is disabled in demo mode.')} delay={500}>
      <div
        data-test-id="demo-mode-disabled-wrapper"
        style={{
          opacity: 0.6,
          cursor: 'not-allowed',
        }}
      >
        <div
          style={{
            pointerEvents: 'none',
          }}
        >
          {children}
        </div>
      </div>
    </Tooltip>
  );
}

export default DisableInDemoMode;
