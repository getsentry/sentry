import React from 'react';
import ReactSelect, {components, OptionProps} from 'react-select';
import styled from '@emotion/styled';

import SelectControl from 'app/components/forms/selectControl';
import space from 'app/styles/space';
import {MemberRole} from 'app/types';
import theme from 'app/utils/theme';

// TODO(ts) Add SelectControl types when it gets them.
type Props = Omit<React.ComponentProps<typeof ReactSelect>, 'value'> & {
  roles: MemberRole[];
  disableUnallowed: boolean;
  value?: string;
};

type OptionType = {
  label: string;
  value: string;
  disabled: boolean;
  description: string;
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
  grid-gap: ${space(1)};

  h1,
  div {
    font-size: ${p => p.theme.fontSizeSmall};
    line-height: 1.4;
    margin: ${space(0.25)} 0;
  }
`;

export default RoleSelectControl;
