import {WithRouterProps} from 'react-router';
import {Organization} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';

const mockUsingCustomerDomain = jest.fn();
const mockCustomerDomain = jest.fn();

jest.mock('sentry/constants', () => {
  const sentryConstant = jest.requireActual('sentry/constants');
  return {
    ...sentryConstant,

    get usingCustomerDomain() {
      return mockUsingCustomerDomain();
    },

    get customerDomain() {
      return mockCustomerDomain();
    },
  };
});

describe('withSentryRouter', function () {
  type Props = WithRouterProps<{orgId: string}>;
  function MyComponent(props: Props) {
    const {params} = props;
    return <div>Org slug: {params.orgId ?? 'no org slug'}</div>;
  }

  it('injects orgId when a customer domain is being used', function () {
    mockUsingCustomerDomain.mockReturnValue(true);
    mockCustomerDomain.mockReturnValue('albertos-apples');

    const organization = Organization({
      slug: 'albertos-apples',
      features: [],
    });

    const {routerContext} = initializeOrg({
      organization,
    });

    const WrappedComponent = withSentryRouter(MyComponent);
    render(<WrappedComponent />, {
      context: routerContext,
    });

    expect(screen.getByText('Org slug: albertos-apples')).toBeInTheDocument();
  });

  it('does not inject orgId when a customer domain is not being used', function () {
    mockUsingCustomerDomain.mockReturnValue(false);
    mockCustomerDomain.mockReturnValue(undefined);

    const organization = Organization({
      slug: 'albertos-apples',
      features: [],
    });

    const params = {
      orgId: 'something-else',
    };
    const {routerContext} = initializeOrg({
      organization,
      router: {
        params,
      },
    });

    const WrappedComponent = withSentryRouter(MyComponent);
    render(<WrappedComponent />, {
      context: routerContext,
    });

    expect(screen.getByText('Org slug: something-else')).toBeInTheDocument();
  });
});
