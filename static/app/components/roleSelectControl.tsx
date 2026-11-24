import type {DistributedOmit} from 'type-fest';

import {Container} from '@sentry/scraps/layout';
import type {ControlProps} from '@sentry/scraps/select';
import {Select} from '@sentry/scraps/select';

import type {BaseRole} from 'sentry/types/organization';
import {useOrganization} from 'sentry/utils/useOrganization';

type RoleOption = {
  details: React.ReactNode;
  disabled: boolean;
  label: string;
  value: string;
};

type SingleSelectProps = Exclude<ControlProps<string, RoleOption>, {multiple: true}>;

type Props = DistributedOmit<SingleSelectProps, 'multiple' | 'value' | 'options'> & {
  disableUnallowed: boolean;
  roles: BaseRole[];
  value: string | null;
  /** Allows role descriptions to wrap within the available menu width. */
  keepMenuInViewport?: boolean;
};

export function RoleSelectControl({
  roles,
  disableUnallowed,
  keepMenuInViewport,
  ...props
}: Props) {
  const organization = useOrganization();
  const isMemberInvite =
    organization.allowMemberInvite && organization.access?.includes('member:invite');

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
            <Container
              as="span"
              display="inline-block"
              // A capped menu sets the width, so let details wrap to fit it.
              width={props.maxMenuWidth === undefined ? '20rem' : undefined}
              maxWidth={keepMenuInViewport ? '100%' : undefined}
            >
              {r.desc}
            </Container>
          ),
        }))}
      showDividers
      {...props}
    />
  );
}
