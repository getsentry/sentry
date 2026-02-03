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

describe('Relocation Onboarding Container', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/publickeys/relocations/',
      body: {
        public_key: fakePublicKey,
      },
    });
    MockApiClient.addMockResponse({
      url: '/relocations/',
      body: [],
    });
  });

  it('should render if feature enabled', async () => {
    ConfigStore.set('features', new Set(['relocation:enabled']));
    render(<RelocationOnboardingContainer />, {
      initialRouterConfig: {
        location: {
          pathname: '/relocation/get-started/',
        },
        route: '/relocation/:step/',
      },
    });
    expect(
      await screen.findByText(/Choose where to store your organization's data/)
    ).toBeInTheDocument();
    expect(
      screen.queryByText("You don't have access to this feature")
    ).not.toBeInTheDocument();
  });

  it('should not render if feature disabled', async () => {
    ConfigStore.set('features', new Set([]));
    render(<RelocationOnboardingContainer />, {
      initialRouterConfig: {
        location: {
          pathname: '/relocation/get-started/',
        },
        route: '/relocation/:step/',
      },
    });
    expect(
      await screen.findByText("You don't have access to this feature")
    ).toBeInTheDocument();
  });
});
