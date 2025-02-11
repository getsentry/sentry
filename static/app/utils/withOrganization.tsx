import type {Organization} from 'sentry/types/organization';
import getDisplayName from 'sentry/utils/getDisplayName';

import useOrganization from './useOrganization';

type InjectedOrganizationProps = {
  organization?: Organization;
  organizationAllowNull?: undefined | true;
};

function withOrganization<P extends InjectedOrganizationProps>(
  WrappedComponent: React.ComponentType<P>
) {
  type Props = Omit<P, keyof InjectedOrganizationProps> &
    Partial<InjectedOrganizationProps>;

  function Wrapper(props: Props) {
    const organization = useOrganization({allowNull: props.organizationAllowNull});

    const allProps = {organization, ...props} as P;

    // TODO(any): HoC prop types not working w/ emotion https://github.com/emotion-js/emotion/issues/3261
    return <WrappedComponent {...(allProps as P as any)} />;
  }

  Wrapper.displayName = `withOrganization(${getDisplayName(WrappedComponent)})`;

  return Wrapper;
}

export default withOrganization;
