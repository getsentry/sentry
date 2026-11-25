import styled from '@emotion/styled';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {QuerySpeedMenu} from 'sentry/components/querySpeedMenu';
import {t} from 'sentry/locale';
import {
  ToolbarHeader,
  ToolbarLabel,
  ToolbarRow,
  ToolbarSection,
} from 'sentry/views/explore/components/toolbar/styles';
import {useExploreQuerySpeed} from 'sentry/views/explore/hooks/useExploreQuerySpeed';
import {Tab, useTab} from 'sentry/views/explore/hooks/useTab';

export function ToolbarQuerySpeed() {
  const {enabled, isReady, loadFailed, lockedToBalanced, setSpeed, speed} =
    useExploreQuerySpeed();
  const [tab] = useTab();
  // These tables have no sampling mode, so the control cannot change them.
  const disabledForTraces = tab === Tab.TRACE;
  const disabledForAttributeBreakdowns = tab === Tab.ATTRIBUTE_BREAKDOWNS;
  const disabled =
    lockedToBalanced || disabledForTraces || disabledForAttributeBreakdowns;

  if (!enabled) {
    return null;
  }

  let speedControl = (
    <ToolbarRow>
      <ColumnQuerySpeedMenu
        disabled={disabled}
        onChange={setSpeed}
        trigger={triggerProps => (
          <OverlayTrigger.Button {...triggerProps} data-query-speed-trigger="" />
        )}
        value={isReady ? speed : undefined}
      />
    </ToolbarRow>
  );

  let disabledTitle = t('Disabling extrapolation cannot be combined with query speed.');
  if (disabledForTraces) {
    disabledTitle = t('Query speed is not applicable to trace results.');
  } else if (disabledForAttributeBreakdowns) {
    disabledTitle = t('Query speed is not applicable to attribute breakdowns.');
  }

  if (disabled) {
    speedControl = (
      <FullWidthTooltip position="top" title={disabledTitle}>
        {speedControl}
      </FullWidthTooltip>
    );
  }

  return (
    <ToolbarSection data-test-id="section-query-speed">
      <ToolbarHeader>
        <Tooltip
          position="right"
          title={t(
            'How quickly results come back, and how much data is scanned. Does not apply to exports.'
          )}
        >
          <ToolbarLabel disabled={disabled}>{t('Query Speed')}</ToolbarLabel>
        </Tooltip>
      </ToolbarHeader>
      {loadFailed && (
        <ToolbarRow>
          <Text variant="danger">{t("Couldn't load the saved query speed.")}</Text>
        </ToolbarRow>
      )}
      {(isReady || loadFailed) && speedControl}
    </ToolbarSection>
  );
}

const FullWidthTooltip = styled(Tooltip)`
  width: 100%;
`;

const ColumnQuerySpeedMenu = styled(QuerySpeedMenu)`
  flex: 1 1;
  min-width: 0;

  [data-query-speed-trigger] {
    width: 100%;
  }
`;
