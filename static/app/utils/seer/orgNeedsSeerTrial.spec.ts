import {OrganizationFixture} from 'sentry-fixture/organization';

import {orgNeedsSeerTrial} from 'sentry/utils/seer/orgNeedsSeerTrial';

describe('orgNeedsSeerTrial', () => {
  it('returns true when seer-user-billing-launch is present', () => {
    const organization = OrganizationFixture({
      features: ['seer-user-billing-launch'],
    });

    expect(orgNeedsSeerTrial(organization)).toBe(true);
  });

  it('returns false when hideAiFeatures is true', () => {
    const organization = OrganizationFixture({
      features: ['seer-user-billing-launch'],
      hideAiFeatures: true,
    });

    expect(orgNeedsSeerTrial(organization)).toBe(false);
  });

  it('returns false when seat-based-seer-enabled is present', () => {
    const organization = OrganizationFixture({
      features: ['seat-based-seer-enabled'],
    });

    expect(orgNeedsSeerTrial(organization)).toBe(false);
  });

  it('returns false when seer-added is present', () => {
    const organization = OrganizationFixture({
      features: ['seer-added'],
    });

    expect(orgNeedsSeerTrial(organization)).toBe(false);
  });

  it('returns false when code-review-beta is present', () => {
    const organization = OrganizationFixture({
      features: ['code-review-beta'],
    });

    expect(orgNeedsSeerTrial(organization)).toBe(false);
  });

  it('returns false when no relevant features are present', () => {
    const organization = OrganizationFixture({
      features: [],
    });

    expect(orgNeedsSeerTrial(organization)).toBe(false);
  });
});
