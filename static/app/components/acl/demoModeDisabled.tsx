import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {isDemoModeEnabled} from 'sentry/utils/demoMode';

type Props = {
  /**
   * Children can be a node or a function as child.
   */
  children?: React.ReactNode;
};

/**
 * Component to handle demo mode switches
 */
function DisableInDemoMode({children}: Props) {
  if (!isDemoModeEnabled()) {
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
