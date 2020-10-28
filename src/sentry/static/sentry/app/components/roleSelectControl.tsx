import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import SelectControl from 'app/components/forms/selectControl';
import {MemberRole} from 'app/types';

type Props = SelectControl['props'] & {
  roles: MemberRole[];
  disableUnallowed: boolean;
};

const RoleSelector = ({roles, disableUnallowed, ...props}: Props) => (
  <RoleSelectControl
    deprecatedSelectControl
    options={
      roles &&
      roles.map(r => ({
        value: r.id,
        label: r.name,
        disabled: disableUnallowed && !r.allowed,
      }))
    }
    optionRenderer={option => {
      const {name, desc} = roles.find(r => r.id === option.value)!;

      return (
        <RoleItem>
          <h1>{name}</h1>
          <div>{desc}</div>
        </RoleItem>
      );
    }}
    {...props}
  />
);

const RoleSelectControl = styled(SelectControl)`
  .Select-menu-outer {
    margin-top: ${space(1)};
    width: 350px;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0 0 6px rgba(0, 0, 0, 0.15);
  }

  &.Select.is-focused.is-open > .Select-control {
    border-radius: 4px;
  }

  .Select-option:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }
`;

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

export default RoleSelector;
