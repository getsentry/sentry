import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';

import RelocationOnboardingContainer from './index';

const fakePublicKey = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAw5Or1zsGE1XJTL4q+1c4
Ztu8+7SC/exrnEYlWH+LVLI8TVyuGwDTAXrgKHGwaMM5ZnjijP5i8+ph8lfLrybT
l+2D81qPIqagEtNMDaHqUDm5Tq7I2qvxkJ5YuDLawRUPccKMwWlIDR2Gvfe3efce
870EicPsExz4uPOkNXGHJZ/FwCQrLo87MXFeqrqj+0Cf+qwCQSCW9qFWe5cj+zqt
eeJa0qflcHHQzxK4/EKKpl/hkt4zi0aE/PuJgvJz2KB+X3+LzekTy90LzW3VhR4y
IAxCAaGQJVsg9dhKOORjAf4XK9aXHvy/jUSyT43opj6AgNqXlKEQjb1NBA8qbJJS
8wIDAQAB
-----END PUBLIC KEY-----`;

describe('Relocation Onboarding Container', function () {
  beforeEach(function () {
    MockApiClient.asyncDelay = undefined;
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/publickeys/relocations/',
      body: {
        public_key: fakePublicKey,
      },
    });

    // The tests fail because we have a "component update was not wrapped in act" error. It should
    // be safe to ignore this error, but we should remove the mock once we move to react testing
    // library.
    //
    // eslint-disable-next-line no-console
    jest.spyOn(console, 'error').mockImplementation(jest.fn());
  });

  it('should render if feature enabled', function () {
    const {routerProps, routerContext, organization} = initializeOrg({
      router: {
        params: {step: '1'},
      },
    });
    ConfigStore.set('features', new Set(['relocation:enabled']));
    render(<RelocationOnboardingContainer {...routerProps} />, {
      context: routerContext,
      organization,
    });
    expect(
      screen.queryByText("You don't have access to this feature")
    ).not.toBeInTheDocument();
  });

  it('should not render if feature disabled', async function () {
    const {routerProps, routerContext, organization} = initializeOrg({
      router: {
        params: {step: '1'},
      },
    });
    ConfigStore.set('features', new Set([]));
    render(<RelocationOnboardingContainer {...routerProps} />, {
      context: routerContext,
      organization,
    });
    expect(
      await screen.queryByText("You don't have access to this feature")
    ).toBeInTheDocument();
  });
});
