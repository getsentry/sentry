import {screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  getEmbedLinkHref,
  renderEmbed,
} from 'sentry/components/seer/markdown/embeds/components/resourceEmbedTestUtils';
import {Flamegraph} from 'sentry/utils/profiling/flamegraph';
import * as importProfileModule from 'sentry/utils/profiling/profile/importProfile';

const {importProfile} = importProfileModule;

const PROJECT_SLUG = 'javascript';
const PROFILE_ID = '7f3c2b1a9d8e4f60';
const PROFILE_URL = `/projects/org-slug/${PROJECT_SLUG}/profiling/profiles/${PROFILE_ID}/`;

function makeProfileSchema() {
  return {
    activeProfileIndex: 0,
    profileID: PROFILE_ID,
    projectID: 2,
    metadata: {
      androidAPILevel: 0,
      deviceClassification: 'high',
      deviceLocale: 'en_US',
      deviceManufacturer: 'Apple',
      deviceModel: 'iPhone14,3',
      deviceOSName: 'iOS',
      deviceOSVersion: '16.0',
      environment: 'production',
      organizationID: 1,
      platform: 'cocoa',
      profileID: PROFILE_ID,
      projectID: 2,
      received: '2026-08-25T16:37:12Z',
      release: {version: '1.0.0'},
      timestamp: '2026-08-25T16:37:12Z',
      traceID: 'ff62a8b040f34bbda121af0aac2b5f0d',
      transactionID: '8b90e2f0b1a94b3e9b5b0a3d2c1e4f60',
      transactionName: 'iOS-Swift.ViewController',
    },
    profiles: [
      {
        name: 'main',
        startValue: 0,
        endValue: 1000,
        unit: 'milliseconds',
        threadID: 0,
        type: 'sampled',
        weights: [10, 10],
        samples: [[0], [0, 1]],
      },
    ],
    shared: {frames: [{name: 'main'}, {name: 'doWork'}]},
  };
}

const DEEP_PROFILE_DEPTH = 40;

/**
 * Deep enough to overflow the 200px preview, with two samples that share no
 * root frame -- the shape that made the preview open on the deepest rows.
 */
function makeDeepProfileSchema() {
  return {
    ...makeProfileSchema(),
    profiles: [
      {
        name: 'main',
        startValue: 0,
        endValue: 1000,
        unit: 'milliseconds',
        threadID: 0,
        type: 'sampled',
        weights: [500, 500],
        samples: [
          [DEEP_PROFILE_DEPTH, DEEP_PROFILE_DEPTH + 1],
          Array.from({length: DEEP_PROFILE_DEPTH}, (_, i) => i),
        ],
      },
    ],
    shared: {
      frames: Array.from({length: DEEP_PROFILE_DEPTH + 2}, (_, i) => ({
        name: `frame${i}`,
      })),
    },
  };
}

function renderProfileBlock(body: unknown = makeProfileSchema(), statusCode = 200) {
  MockApiClient.addMockResponse({url: PROFILE_URL, body, statusCode});

  return renderEmbed({
    name: 'profile',
    data: {projectSlug: PROJECT_SLUG, profileId: PROFILE_ID},
  });
}

describe('profile embed', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('links a profile to its flamegraph', () => {
    expect(
      getEmbedLinkHref('profile', 'Profile 7f3c2b1a', {
        projectSlug: PROJECT_SLUG,
        profileId: PROFILE_ID,
      })
    ).toBe(
      '/organizations/org-slug/explore/profiles/profile/javascript/7f3c2b1a9d8e4f60/flamegraph/'
    );
  });

  it('renders the metadata strip and the flamechart preview at block level', async () => {
    renderProfileBlock();

    expect(await screen.findByTestId('seer-profile-flamechart')).toBeInTheDocument();

    // Metadata pulled straight out of the single profile payload
    expect(screen.getByText('Transaction')).toBeInTheDocument();
    expect(screen.getByText('iOS-Swift.ViewController')).toBeInTheDocument();
    expect(screen.getByText('Environment')).toBeInTheDocument();
    expect(screen.getByText('production')).toBeInTheDocument();
    expect(screen.getByText('Release')).toBeInTheDocument();
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('OS')).toBeInTheDocument();
    expect(screen.getByText('iOS 16.0')).toBeInTheDocument();
    expect(screen.getByText('Device')).toBeInTheDocument();
    expect(screen.getByText('iPhone14,3 high')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.getByText('Threads')).toBeInTheDocument();

    // The inline affordance is preserved in the card header
    expect(screen.getByRole('link', {name: 'Profile 7f3c2b1a'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/profiles/profile/javascript/7f3c2b1a9d8e4f60/flamegraph/'
    );
    expect(screen.getByRole('button', {name: 'Open in Profiling'})).toBeInTheDocument();
  });

  it('pairs each view with an import type its sort accepts', () => {
    // `Flamegraph` throws "does not support call order sorting" if a profile
    // imported as 'flamegraph' is sorted by call order, which crashed the whole
    // conversation because the model is built outside the embed's boundary.
    for (const importType of ['flamegraph', 'flamechart'] as const) {
      const group = importProfile(makeProfileSchema() as any, 't', null, importType);
      const profile = group.profiles[0]!;
      const sort = importType === 'flamechart' ? 'call order' : 'left heavy';

      expect(() => new Flamegraph(profile, {sort})).not.toThrow();
    }
  });

  it('degrades to the metadata strip when the chart cannot be built', async () => {
    jest.spyOn(importProfileModule, 'importProfile').mockImplementation(() => {
      throw new TypeError('Flamegraph does not support call order sorting');
    });

    renderProfileBlock();

    // The card still renders; only the chart is missing.
    expect(await screen.findByText('Transaction')).toBeInTheDocument();
    expect(screen.getByTestId('seer-profile-embed')).toBeInTheDocument();
    expect(screen.queryByTestId('seer-profile-flamechart')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', {name: 'Time-ordered'})).not.toBeInTheDocument();
  });

  it('opens the preview at the root of a deep profile in both views', async () => {
    renderProfileBlock(makeDeepProfileSchema());
    await screen.findByTestId('seer-profile-flamechart');

    // The viewport the preview settled on is observable through the deep link's
    // `fov` rect: "x,y,width,height", so y === 0 means it starts at the root.
    const viewportY = () =>
      decodeURIComponent(
        screen.getByRole('button', {name: 'Open in Profiling'}).getAttribute('href') ?? ''
      ).replace(/^.*fov=[^,]*,([^,]*).*$/, '$1');

    expect(viewportY()).toBe('0');

    await userEvent.click(screen.getByRole('radio', {name: 'Time-ordered'}));

    await waitFor(() => {
      expect(screen.getByRole('radio', {name: 'Time-ordered'})).toBeChecked();
    });
    expect(viewportY()).toBe('0');
  });

  it('deep-links the previewed viewport under the sort it was captured with', async () => {
    renderProfileBlock();
    await screen.findByTestId('seer-profile-flamechart');

    const openInProfiling = () => screen.getByRole('button', {name: 'Open in Profiling'});

    // `fov` is a rect in the sorted tree's coordinate space, and the flamegraph
    // page defaults to 'call order', so the link has to name the preview's sort
    // or the encoded viewport lands on unrelated frames.
    expect(openInProfiling()).toHaveAttribute('href', expect.stringContaining('fov='));
    expect(openInProfiling()).toHaveAttribute(
      'href',
      expect.stringContaining('sorting=left%20heavy')
    );

    await userEvent.click(screen.getByRole('radio', {name: 'Time-ordered'}));

    await waitFor(() => {
      expect(openInProfiling()).toHaveAttribute(
        'href',
        expect.stringContaining('sorting=call%20order')
      );
    });
  });

  it('keeps the view toggle local to the embed', async () => {
    const {router} = renderProfileBlock();

    const timeOrdered = await screen.findByRole('radio', {name: 'Time-ordered'});
    const locationBefore = router.location;

    await userEvent.click(timeOrdered);

    await waitFor(() => {
      expect(screen.getByRole('radio', {name: 'Time-ordered'})).toBeChecked();
    });

    // The embed must not write its interaction state into the host page URL
    expect(router.location.pathname).toBe(locationBefore.pathname);
    expect(router.location.query).toEqual(locationBefore.query);
    expect(screen.getByTestId('seer-profile-flamechart')).toBeInTheDocument();
  });

  it('degrades to the link when the profile cannot be loaded', async () => {
    renderProfileBlock({detail: 'Not found'}, 404);

    expect(await screen.findByText('Unable to load profile details')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Profile 7f3c2b1a'})).toBeInTheDocument();
    expect(screen.queryByTestId('seer-profile-flamechart')).not.toBeInTheDocument();
  });

  it('degrades to the link for a continuous profile chunk payload', async () => {
    renderProfileBlock({
      chunk_id: 'a1b2c3d4e5f60718',
      profiler_id: 'b2c3d4e5f6071829',
      environment: 'production',
      platform: 'cocoa',
      version: '2',
      profile: {samples: [], stacks: [], frames: []},
    });

    expect(
      await screen.findByRole('link', {name: 'Profile 7f3c2b1a'})
    ).toBeInTheDocument();
    expect(screen.queryByTestId('seer-profile-flamechart')).not.toBeInTheDocument();
    expect(screen.queryByText('Transaction')).not.toBeInTheDocument();
  });
});
