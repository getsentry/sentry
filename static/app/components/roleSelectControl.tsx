import {components, OptionProps} from 'react-select';
import styled from '@emotion/styled';

import SelectControl, {ControlProps} from 'sentry/components/forms/selectControl';
import space from 'sentry/styles/space';
import {MemberRole} from 'sentry/types';
import theme from 'sentry/utils/theme';

type OptionType = {
  description: string;
  disabled: boolean;
  label: string;
  value: string;
};

type Props = Omit<ControlProps<OptionType>, 'onChange' | 'value'> & {
  disableUnallowed: boolean;
  roles: MemberRole[];
  /**
   * Narrower type than SelectControl because there is no empty value
   */
  onChange?: (value: OptionType) => void;
  value?: string;
};

function RoleSelectControl({roles, disableUnallowed, ...props}: Props) {
  return (
    <SelectControl
      options={roles?.map(
        (r: MemberRole) =>
          ({
            value: r.id,
            label: r.name,
            disabled: disableUnallowed && !r.allowed,
            description: r.desc,
          } as OptionType)
      )}
      components={{
        Option: ({label, data, ...optionProps}: OptionProps<OptionType>) => (
          <components.Option label={label} {...(optionProps as any)}>
            <RoleItem>
              <h1>{label}</h1>
              <div>{data.description}</div>
            </RoleItem>
          </components.Option>
        ),
      }}
      styles={{
        control: provided => ({
          ...provided,
          borderBottomLeftRadius: theme.borderRadius,
          borderBottomRightRadius: theme.borderRadius,
        }),
        menu: provided => ({
          ...provided,
          borderRadius: theme.borderRadius,
          marginTop: space(0.5),
          width: '350px',
          overflow: 'hidden',
        }),
      }}
      {...props}
    />
  );
}

const RoleItem = styled('div')`
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: ${space(1)};
  margin-bottom: ${space(1)};

  h1,
  div {
    font-size: ${p => p.theme.fontSizeSmall};
    line-height: 1.4;
    margin: ${space(0.25)} 0;
  }
`;

export default RoleSelectControl;
