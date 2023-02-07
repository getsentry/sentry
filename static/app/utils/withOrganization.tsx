import {Organization} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';

import useOrganization from './useOrganization';

type InjectedOrganizationProps = {
  organization?: Organization;
};

type WrappedProps<P> = Omit<P, keyof InjectedOrganizationProps> &
  InjectedOrganizationProps;

const withOrganization = <P extends InjectedOrganizationProps>(
  WrappedComponent: React.ComponentType<P>
) => {
  const WithOrganization: React.FC<WrappedProps<P>> = props => {
    const organization = useOrganization();

    return <WrappedComponent organization={organization} {...(props as P)} />;
  };

  WithOrganization.displayName = `withOrganization(${getDisplayName(WrappedComponent)})`;

  return WithOrganization;
};

export default withOrganization;
