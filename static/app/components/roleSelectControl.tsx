import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import type {DistributedOmit} from 'type-fest';

import {Container} from '@sentry/scraps/layout';
import type {ControlProps} from '@sentry/scraps/select';
import {Select} from '@sentry/scraps/select';

import type {BaseRole} from 'sentry/types/organization';
import {useOrganization} from 'sentry/utils/useOrganization';

type OptionType = {
  details: React.ReactNode;
  disabled: boolean;
  label: string;
  value: string;
};

type SingleSelectProps = Exclude<ControlProps<OptionType>, {multiple: true}>;

type Props = DistributedOmit<SingleSelectProps, 'isMulti' | 'value'> & {
  disableUnallowed: boolean;
  roles: BaseRole[];
  /**
   * Requires `menuPortalTarget={document.body}`: the shift is computed from
   * viewport coordinates.
   */
  keepMenuInViewport?: boolean;
  value?: string | null;
};

export function RoleSelectControl({
  roles,
  disableUnallowed,
  keepMenuInViewport,
  ...props
}: Props) {
  const organization = useOrganization();
  const theme = useTheme();
  const isMemberInvite =
    organization.allowMemberInvite && organization.access?.includes('member:invite');

  const menuInViewportStyles = useMemo<SingleSelectProps['styles']>(() => {
    if (!keepMenuInViewport) {
      return;
    }

    const gutter = theme.space.xl;

    return {
      menuPortal: base =>
        typeof base.left === 'number'
          ? {
              ...base,
              '--menu-space-left': `${base.left}px`,
              '--menu-space-right': `${document.documentElement.clientWidth - base.left}px`,
            }
          : base,
      menu: base => ({
        ...base,
        // translateX percentages resolve against the menu's own width, which
        // react-select doesn't know when it positions the portal.
        transform: `translateX(clamp(calc(${gutter} - var(--menu-space-left)), calc(var(--menu-space-right) - ${gutter} - 100%), 0px))`,
      }),
    };
  }, [keepMenuInViewport, theme.space.xl]);

  return (
    <Select
      options={roles
        ?.filter(r => !r.isRetired)
        .map((r: BaseRole) => ({
          value: r.id,
          label: r.name,
          disabled:
            disableUnallowed && !r.isAllowed && !(isMemberInvite && r.id === 'member'),
          details: (
            <Container as="span" display="inline-block" width="20rem">
              {r.desc}
            </Container>
          ),
        }))}
      showDividers
      styles={menuInViewportStyles}
      {...props}
    />
  );
}
