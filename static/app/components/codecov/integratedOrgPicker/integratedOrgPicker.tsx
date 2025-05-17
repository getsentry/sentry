import {updateIntegratedOrg} from 'sentry/actionCreators/pageFilters';
import {t} from 'sentry/locale';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';

import {
  IntegratedOrgSelector,
  type IntegratedOrgSelectorProps,
} from './integratedOrgSelector';

export interface IntegratedOrgProps extends Partial<IntegratedOrgSelectorProps> {}

export function IntegratedOrgPicker({
  menuTitle,
  menuWidth,
  triggerProps = {},
  ...selectProps
}: IntegratedOrgProps) {
  const router = useRouter();
  const {selection} = usePageFilters();

  return (
    <IntegratedOrgSelector
      triggerLabel={selection.integratedOrg ?? t('Select an integrated organization')}
      {...selectProps}
      onChange={newIntegratedOrg => {
        updateIntegratedOrg(newIntegratedOrg.integratedOrg, router, {
          save: true,
        });
      }}
      menuTitle={menuTitle ?? t('Filter Integrated Organization')}
      menuWidth={menuWidth ? '22em' : undefined}
      triggerProps={triggerProps}
    />
  );
}
