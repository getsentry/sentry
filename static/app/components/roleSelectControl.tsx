import styled from '@emotion/styled';

import SelectControl, {
  ControlProps,
} from 'sentry/components/forms/controls/selectControl';
import {MemberRole} from 'sentry/types';

type OptionType = {
  details: React.ReactNode;
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
  value?: string | null;
};

function RoleSelectControl({roles, disableUnallowed, ...props}: Props) {
  return (
    <SelectControl
      options={roles?.map(
        (r: MemberRole) =>
          ({
            value: r.id,
            label: r.name,
            disabled: (disableUnallowed && !r.allowed) || r.isRetired,
            details: <Details>{r.desc}</Details>,
          } as OptionType)
      )}
      showDividers
      {...props}
    />
  );
}

export default RoleSelectControl;

const Details = styled('span')`
  display: inline-block;
  width: 20rem;
`;
