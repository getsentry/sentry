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

    return <WrappedComponent {...allProps} />;
  }

  Wrapper.displayName = `withOrganization(${getDisplayName(WrappedComponent)})`;

  return Wrapper;
}

export default withOrganization;
