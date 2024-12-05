import {
  CompactSelect,
  type SelectOption,
  type SelectProps,
} from 'sentry/components/compactSelect';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

type EapOption = 'useEap' | 'noEap' | 'useEapRpc';

/**
 * This selector allows us to with and without EAP enabled
 * @returns
 */
export function EapSelector() {
  const navigate = useNavigate();
  const location = useLocation();
  const {features} = useOrganization();
  const {useEap, useRpc} = useEapOptions();
  const hasEAPFeature = features.includes('insights-use-eap');

  type Options = SelectProps<EapOption>['options'];

  const options: Options = [
    {
      value: 'noEap',
      label: "Don't use EAP",
    },
    {
      value: 'useEap',
      label: 'Use EAP',
    },
    {
      value: 'useEapRpc',
      label: 'Use RPC EAP',
    },
  ];

  let value: EapOption = 'useEap';
  if (!useEap) {
    value = 'noEap';
  } else if (useRpc) {
    value = 'useEapRpc';
  }

  if (hasEAPFeature) {
    return (
      <CompactSelect
        options={options}
        value={value}
        onChange={(selectedOption: SelectOption<EapOption>) =>
          navigate({
            ...location,
            query: {
              ...location.query,
              eap_option: selectedOption.value,
            },
          })
        }
      />
    );
  }

  return undefined;
}

export function useEapOptions(): {useEap: boolean; useRpc: boolean} {
  const location = useLocation();
  const {features} = useOrganization();
  const hasEAPFeature = features.includes('insights-use-eap');

  if (!hasEAPFeature) {
    return {useEap: false, useRpc: false};
  }

  const eapOption = location.query.eap_option as EapOption;
  switch (eapOption) {
    case 'noEap':
      return {useEap: false, useRpc: false};
    case 'useEap':
      return {useEap: true, useRpc: false};
    case 'useEapRpc':
      return {useEap: true, useRpc: true};
    default:
      return {useEap: true, useRpc: false};
  }
}
