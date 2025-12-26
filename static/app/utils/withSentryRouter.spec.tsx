import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {WithRouterProps} from 'sentry/types/legacyReactRouter';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';

const mockUsingCustomerDomain = jest.fn();
const mockCustomerDomain = jest.fn();

jest.mock('sentry/constants', () => {
  const sentryConstant = jest.requireActual('sentry/constants');
  return {
    ...sentryConstant,

    get USING_CUSTOMER_DOMAIN() {
      return mockUsingCustomerDomain();
    },

    get CUSTOMER_DOMAIN() {
      return mockCustomerDomain();
    },
  };
});

describe('withSentryRouter', () => {
  type Props = WithRouterProps<{orgId: string}>;
  function MyComponent(props: Props) {
    const {params} = props;
    return <div>Org slug: {params.orgId ?? 'no org slug'}</div>;
  }

  it('injects orgId when a customer domain is being used', () => {
    mockUsingCustomerDomain.mockReturnValue(true);
    mockCustomerDomain.mockReturnValue('albertos-apples');

    const organization = OrganizationFixture({
      slug: 'albertos-apples',
      features: [],
    });

    const WrappedComponent = withSentryRouter(MyComponent);
    render(<WrappedComponent />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/issues/',
        },
      },
    });

    expect(screen.getByText('Org slug: albertos-apples')).toBeInTheDocument();
  });

  it('does not inject orgId when a customer domain is not being used', () => {
    mockUsingCustomerDomain.mockReturnValue(false);
    mockCustomerDomain.mockReturnValue(undefined);

    const organization = OrganizationFixture({
      slug: 'albertos-apples',
      features: [],
    });

    const WrappedComponent = withSentryRouter(MyComponent);
    render(<WrappedComponent />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/something-else/issues/',
        },
        route: '/organizations/:orgId/issues/',
      },
    });

    expect(screen.getByText('Org slug: something-else')).toBeInTheDocument();
  });
});
