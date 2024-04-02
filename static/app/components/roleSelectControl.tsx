import styled from '@emotion/styled';

import type {ControlProps} from 'sentry/components/forms/controls/selectControl';
import SelectControl from 'sentry/components/forms/controls/selectControl';
import type {BaseRole} from 'sentry/types';

type OptionType = {
  details: React.ReactNode;
  disabled: boolean;
  label: string;
  value: string;
};

type Props = Omit<ControlProps<OptionType>, 'onChange' | 'value'> & {
  disableUnallowed: boolean;
  roles: BaseRole[];
  /**
   * Narrower type than SelectControl because there is no empty value
   */
  onChange?: (value: OptionType) => void;
  value?: string | null;
};

function RoleSelectControl({roles, disableUnallowed, ...props}: Props) {
  return (
    <SelectControl
      options={roles
        ?.filter(r => !r.isRetired)
        .map(
          (r: BaseRole) =>
            ({
              value: r.id,
              label: r.name,
              disabled: disableUnallowed && !r.isAllowed,
              details: <Details>{r.desc}</Details>,
            }) as OptionType
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
