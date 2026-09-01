import {OrganizationFixture} from 'sentry-fixture/organization';

import {orgHasIssueInbox} from 'sentry/utils/seer/orgHasIssueInbox';

describe('orgHasIssueInbox', () => {
  it('requires a Seer entitlement for the rollout feature', () => {
    expect(
      orgHasIssueInbox(
        OrganizationFixture({
          features: ['issue-inbox-seer-rollout', 'seat-based-seer-enabled'],
        })
      )
    ).toBe(true);
    expect(
      orgHasIssueInbox(OrganizationFixture({features: ['issue-inbox-seer-rollout']}))
    ).toBe(false);
  });
});
