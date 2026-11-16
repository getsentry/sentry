import type {SelectOption} from '@sentry/scraps/compactSelect';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {
  ToolbarHeader,
  ToolbarLabel,
  ToolbarRow,
  ToolbarSection,
} from 'sentry/views/explore/components/toolbar/styles';
import {
  useExploreQuerySpeed,
  type ExploreQuerySpeed,
} from 'sentry/views/explore/hooks/useExploreQuerySpeed';

import {ColumnCompactSelect} from './toolbarSortBy';

const QUERY_SPEED_OPTIONS: Array<SelectOption<ExploreQuerySpeed>> = [
  {
    value: 'normal',
    label: t('Balanced Querying'),
    details: t('Balances speed and accuracy'),
  },
  {
    value: 'faster',
    label: t('Fast Querying'),
    details: t('Faster with reduced accuracy'),
  },
];

export function ToolbarQuerySpeed() {
  const {enabled, isReady, loadFailed, setSpeed, speed} = useExploreQuerySpeed();

  if (!enabled) {
    return null;
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
          <ToolbarLabel>{t('Query Speed')}</ToolbarLabel>
        </Tooltip>
      </ToolbarHeader>
      {loadFailed && (
        <ToolbarRow>
          <Text variant="danger">{t("Couldn't load the saved query speed.")}</Text>
        </ToolbarRow>
      )}
      {(isReady || loadFailed) && (
        <ToolbarRow>
          <ColumnCompactSelect
            options={QUERY_SPEED_OPTIONS}
            value={isReady ? speed : undefined}
            onChange={option => {
              if (option.value === 'normal' || option.value === 'faster') {
                setSpeed(option.value);
              }
            }}
          />
        </ToolbarRow>
      )}
    </ToolbarSection>
  );
}
