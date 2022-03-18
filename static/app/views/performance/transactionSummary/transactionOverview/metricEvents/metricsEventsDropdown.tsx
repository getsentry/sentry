import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import DropdownControl, {DropdownItem} from 'sentry/components/dropdownControl';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {useMEPPageSettingContext} from 'sentry/utils/performance/contexts/metricsEnhancedPageSetting';

interface MetricsEventsOption {
  field: SAMPLED_FIELD;
  label: string;
  prefix: string;
}

enum SAMPLED_FIELD {
  UNSAMPLED = 'unsampled',
  SAMPLED = 'sampled',
}

const sampledOption = {
  field: SAMPLED_FIELD.SAMPLED,
  prefix: t('Events'),
  label: t('Sampled'),
};

const unsampledOption = {
  field: SAMPLED_FIELD.UNSAMPLED,
  prefix: t('Events'),
  label: t('Unsampled'),
};

export const METRIC_EVENTS_OPTIONS: MetricsEventsOption[] = [
  sampledOption,
  unsampledOption,
];

export function MetricsEventsDropdown() {
  return (
    <Feature features={['performance-use-metrics']}>
      <InnerDropdown />
    </Feature>
  );
}

function InnerDropdown() {
  const mepPageSetting = useMEPPageSettingContext();

  const currentOption = mepPageSetting.isMEPEnabled ? unsampledOption : sampledOption;

  return (
    <DropdownContainer>
      <DropdownControl
        buttonProps={{prefix: currentOption.prefix}}
        label={currentOption.label}
      >
        {METRIC_EVENTS_OPTIONS.map(option => (
          <DropdownItem
            key={option.field}
            eventKey={option.field}
            isActive={option.field === currentOption.field}
            onSelect={key =>
              mepPageSetting.setMEPEnabled(key === SAMPLED_FIELD.UNSAMPLED)
            }
          >
            {option.label}
          </DropdownItem>
        ))}
      </DropdownControl>
    </DropdownContainer>
  );
}

const DropdownContainer = styled('div')`
  margin-left: ${space(1)};
`;
