import {getEmbedLinkHref} from './resourceEmbedTestUtils';

describe('profile embed', () => {
  it('links a profile to its flamegraph', () => {
    expect(
      getEmbedLinkHref('profile', 'Profile 7f3c2b1a', {
        projectSlug: 'javascript',
        profileId: '7f3c2b1a9d8e4f60',
      })
    ).toBe(
      '/organizations/org-slug/explore/profiles/profile/javascript/7f3c2b1a9d8e4f60/flamegraph/'
    );
  });
});
