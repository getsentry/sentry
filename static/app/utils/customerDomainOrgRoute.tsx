import {Component} from 'react';

import ConfigStore from 'sentry/stores/configStore';

export default function customerDomainOrgRoute<P>(
  WrappedComponent: React.ComponentType<P>
) {
  class CustomerDomainOrgRoute extends Component<P> {
    render() {
      const lastActiveOrganization = ConfigStore.get('lastOrganization');
      const {organizationUrl} = ConfigStore.get('links');
      const params = (this.props as any).params as Record<string, string> | undefined;
      if (params) {
        if (!('orgId' in params)) {
          if (lastActiveOrganization) {
            const currentHostname = new URL(String(window.location)).hostname;
            const orgUrlHostname = new URL('/', organizationUrl).hostname;
            if (currentHostname === orgUrlHostname) {
              return (
                <WrappedComponent
                  {...this.props}
                  params={{...params, orgId: lastActiveOrganization}}
                />
              );
            }
          }
          window.location = organizationUrl;
          return null;
        }
      }
      return <WrappedComponent {...this.props} />;
    }
  }

  return CustomerDomainOrgRoute;
}
