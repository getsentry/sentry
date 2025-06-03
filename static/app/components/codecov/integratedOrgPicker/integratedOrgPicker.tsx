import {useSearchParams} from 'react-router-dom';

import {useCodecovContext} from 'sentry/components/codecov/context/codecovContext';
import {t} from 'sentry/locale';

import {
  IntegratedOrgSelector,
  type IntegratedOrgSelectorProps,
} from './integratedOrgSelector';

export interface IntegratedOrgProps extends Partial<IntegratedOrgSelectorProps> {}

export function IntegratedOrgPicker({
  triggerProps = {},
  ...selectProps
}: IntegratedOrgProps) {
  const {integratedOrg} = useCodecovContext();
  const [searchParams, setSearchParams] = useSearchParams();

  return (
    <IntegratedOrgSelector
      triggerLabel={integratedOrg ?? t('Select an integrated organization')}
      {...selectProps}
      onChange={newIntegratedOrg => {
        const currentParams = Object.fromEntries(searchParams.entries());
        const updatedParams = {
          ...currentParams,
          integratedOrg: newIntegratedOrg,
        };
        setSearchParams(updatedParams);
      }}
      triggerProps={triggerProps}
      chosenOrg={integratedOrg}
    />
  );
}
