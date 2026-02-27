import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';

jest.mock('sentry/utils/replays/hooks/useReplayData', () => ({
  __esModule: true,
  default: () => jest.fn().mockReturnValue({}),
}));

const organization = OrganizationFixture();
const project = ProjectFixture();

describe('useLoadReplayReader', () => {
  it('should accept a replaySlug with project and id parts', () => {
    const {result} = renderHookWithProviders(useLoadReplayReader, {
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
    const {result} = renderHookWithProviders(useLoadReplayReader, {
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
