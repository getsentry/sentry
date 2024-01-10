import {Component} from 'react';

import * as SentryPropTypes from 'sentry/sentryPropTypeValidators';
import {Organization} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';

type InjectedOrganizationProps = {
  organization?: Organization;
};

const withOrganization = <P extends InjectedOrganizationProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  class extends Component<
    Omit<P, keyof InjectedOrganizationProps> & InjectedOrganizationProps
  > {
    static displayName = `withOrganization(${getDisplayName(WrappedComponent)})`;
    static contextTypes = {
      organization: SentryPropTypes.isOrganization,
    };

    render() {
      const {organization, ...props} = this.props;
      return (
        <WrappedComponent
          {...({
            organization: organization ?? this.context.organization,
            ...props,
          } as P)}
        />
      );
    }
  };

export default withOrganization;
