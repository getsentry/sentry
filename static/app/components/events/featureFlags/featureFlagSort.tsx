import {IconSort} from '@sentry/icons/sort';

import {CompositeSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';

import {type OrderBy} from './utils';

interface Props {
  orderBy: OrderBy;
  orderByOptions: Array<{
    label: string;
    value: OrderBy;
  }>;
  setOrderBy: (value: React.SetStateAction<OrderBy>) => void;
  size?: 'xs' | 'sm';
  variant?: 'secondary' | 'transparent';
}

export function FeatureFlagSort({
  orderBy,
  setOrderBy,
  orderByOptions,
  size = 'xs',
  variant,
}: Props) {
  return (
    <CompositeSelect
      trigger={triggerProps => (
        <OverlayTrigger.IconButton
          {...triggerProps}
          aria-label={t('Sort Flags')}
          size={size}
          variant={variant}
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
