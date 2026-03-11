import {CompositeSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {type OrderBy} from 'sentry/components/events/featureFlags/utils';
import {IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';

interface Props {
  orderBy: OrderBy;
  orderByOptions: Array<{
    label: string;
    value: OrderBy;
  }>;
  setOrderBy: (value: React.SetStateAction<OrderBy>) => void;
}

export default function FeatureFlagSort({orderBy, setOrderBy, orderByOptions}: Props) {
  return (
    <CompositeSelect
      trigger={triggerProps => (
        <OverlayTrigger.IconButton
          {...triggerProps}
          aria-label={t('Sort Flags')}
          size="xs"
          icon={<IconSort />}
          tooltipProps={{title: t('Sort Flags')}}
        />
      )}
    >
      <CompositeSelect.Region
        label={t('Order By')}
        value={orderBy}
        onChange={selection => {
          setOrderBy(selection.value);
        }}
        options={orderByOptions}
        closeOnSelect={false}
      />
    </CompositeSelect>
  );
}
