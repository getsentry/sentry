import {initializeOrg} from 'sentry-test/initializeOrg';
import {renderHook} from 'sentry-test/reactTestingLibrary';

import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';
import {OrganizationContext} from 'sentry/views/organizationContext';

jest.mock('sentry/utils/replays/hooks/useReplayData', () => ({
  __esModule: true,
  default: () => jest.fn().mockReturnValue({}),
}));

const {organization, project} = initializeOrg();

const wrapper = ({children}: {children?: React.ReactNode}) => (
  <OrganizationContext.Provider value={organization}>
    {children}
  </OrganizationContext.Provider>
);

describe('useLoadReplayReader', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('should accept a replaySlug with project and id parts', () => {
    const {result} = renderHook(useLoadReplayReader, {
      wrapper,
      initialProps: {
        orgSlug: organization.slug,
        replaySlug: `${project.slug}:123`,
      },
    });

    expect(result.current).toStrictEqual(
      expect.objectContaining({
        replayId: '123',
      })
    );
  });

  it('should accept a replaySlug with only the replay-id', () => {
    const {result} = renderHook(useLoadReplayReader, {
      wrapper,
      initialProps: {
        orgSlug: organization.slug,
        replaySlug: `123`,
      },
    });

    expect(result.current).toStrictEqual(
      expect.objectContaining({
        replayId: '123',
      })
    );
  });
});
