import {Organization} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';
import useOrganization from 'sentry/utils/useOrganization';

type InjectedOrganizationProps = {
  organization?: Organization;
};

const withOrganization = <P extends InjectedOrganizationProps>(
  WrappedComponent: React.ComponentType<P>
) => {
  function WithOrganization({
    organization,
    ...props
  }: Omit<P, keyof InjectedOrganizationProps> & InjectedOrganizationProps) {
    const org = useOrganization();

    return <WrappedComponent {...(props as P)} organization={organization ?? org} />;
  }

  WithOrganization.displayNae = `withOrganization(${getDisplayName(WrappedComponent)})`;

  return WithOrganization;
};

export default withOrganization;
