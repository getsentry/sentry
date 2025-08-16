import {useCallback, useMemo, useRef} from 'react';
import type {Theme} from '@emotion/react';

import type {
  ControlProps,
  GeneralSelectValue,
  StylesConfig,
} from 'sentry/components/core/select';
import {Select} from 'sentry/components/core/select';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {
  type EscalationPolicy,
  useFetchEscalationPolicies,
} from 'sentry/views/escalationPolicies/queries/useFetchEscalationPolicies';

const getOptionValue = (option: PolicyOption) => option.value;

const placeholderSelectStyles: StylesConfig = {
  input: (provided, state) => {
    // XXX: The `state.theme` is an emotion theme object, but it is not typed
    // as the emotion theme object in react-select
    const theme = state.theme as unknown as Theme;

    return {
      ...provided,
      display: 'grid',
      gridTemplateColumns: 'max-content 1fr',
      alignItems: 'center',
      gridGap: space(1),
      ':before': {
        backgroundColor: theme.backgroundSecondary,
        height: 24,
        width: 24,
        borderRadius: 3,
        content: '""',
        display: 'block',
      },
    };
  },
  placeholder: provided => ({
    ...provided,
    paddingLeft: 32,
  }),
};

type Props = {
  // onChange: (value: any) => any;
  /**
   * Received via withOrganization
   * Note: withOrganization collects it from the context, this is not type safe
   */
  organization: Organization;
} & ControlProps;

type PolicyOption = GeneralSelectValue & {};

function PolicySelector(props: Props) {
  const {organization, onChange, ...extraProps} = props;
  const {multiple} = props;

  const {isFetching, data: policies} = useFetchEscalationPolicies({
    orgSlug: organization.slug,
  });
  // TODO(ts) This type could be improved when react-select types are better.
  const selectRef = useRef<any>(null);

  const createOption = useCallback(
    (policy: EscalationPolicy): PolicyOption => ({
      value: policy.id + '',
      label: policy.name,
      // leadingItems: <IdBadge team={team} hideName />,
      // searchKey: policy.name,
    }),
    []
  );

  const handleChange = useCallback(
    (newValue: PolicyOption | PolicyOption[]) => {
      if (multiple) {
        const options = newValue as PolicyOption[];
        onChange?.(options as any);
        return;
      }

      const option = newValue as PolicyOption;
      onChange?.(option as any);
    },
    [multiple, onChange]
  );

  const options = useMemo(() => {
    if (policies) return policies.map(createOption);
    return [];
  }, [createOption, policies]);

  const styles = useMemo(
    () => ({
      ...(multiple ? {} : placeholderSelectStyles),
    }),
    [multiple]
  );

  return (
    <Select
      ref={selectRef}
      options={options}
      getOptionValue={getOptionValue}
      // filterOption={filterOption}
      styles={styles}
      isLoading={isFetching}
      onChange={handleChange}
      {...extraProps}
    />
  );
}

export default PolicySelector;
