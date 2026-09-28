import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IssueSeerBadge} from 'sentry/components/group/issueSeerBadge';

describe('IssueSeerBadge', () => {
  // The badge only renders once Seer has something to show, which
  // `getAutofixRunExists` reads off the seer autofix summary.
  const group = GroupFixture({
    id: '101',
    seerAutofixLastTriggered: '2026-07-20T12:00:00Z',
  });

  it('links to the issue details drawer without the autofix-page feature', () => {
    render(<IssueSeerBadge group={group} />, {
      organization: OrganizationFixture({features: ['gen-ai-features']}),
    });

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/101/?seerDrawer=true'
    );
  });

  it('links to the autofix tab with the feature', () => {
    render(<IssueSeerBadge group={group} />, {
      organization: OrganizationFixture({
        features: ['gen-ai-features', 'autofix-page'],
      }),
    });

    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/101/autofix/'
    );
  });
});
