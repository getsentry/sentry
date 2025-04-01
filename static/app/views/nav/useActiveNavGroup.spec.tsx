import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PrimaryNavGroup} from 'sentry/views/nav/types';
import {useActiveNavGroup} from 'sentry/views/nav/useActiveNavGroup';

const mockUsingCustomerDomain = jest.fn();

jest.mock('sentry/constants', () => {
  const sentryConstant = jest.requireActual('sentry/constants');
  return {
    ...sentryConstant,

    get USING_CUSTOMER_DOMAIN() {
      return mockUsingCustomerDomain();
    },
  };
});

describe('useActiveNavGroup', function () {
  beforeEach(() => {
    mockUsingCustomerDomain.mockReturnValue(true);
  });

  function TestComponent() {
    const activeNavGroup = useActiveNavGroup();

    return <div>{activeNavGroup}</div>;
  }

  it('correctly matches when using customer domain', async function () {
    render(<TestComponent />, {
      disableRouterMocks: true,
      initialRouterConfig: {
        location: {
          pathname: '/explore/traces/trace/123/',
        },
      },
    });

    expect(await screen.findByText(PrimaryNavGroup.EXPLORE)).toBeInTheDocument();
  });

  it('correctly matches when not using customer domain', async function () {
    mockUsingCustomerDomain.mockReturnValue(false);

    render(<TestComponent />, {
      disableRouterMocks: true,
      initialRouterConfig: {
        location: {
          pathname: '/organizations/org-slug/explore/traces/trace/123/',
        },
      },
    });

    expect(await screen.findByText(PrimaryNavGroup.EXPLORE)).toBeInTheDocument();
  });
});
