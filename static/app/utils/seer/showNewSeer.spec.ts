import {OrganizationFixture} from 'sentry-fixture/organization';

import showNewSeer from 'sentry/utils/seer/showNewSeer';

describe('showNewSeer', () => {
  describe('new seat-based Seer plan', () => {
    it('returns true when seat-based-seer-enabled is present', () => {
      const organization = OrganizationFixture({
        features: ['seat-based-seer-enabled'],
      });

      expect(showNewSeer(organization)).toBe(true);
    });
  });

  describe('old Seer plan (seer-added)', () => {
    it('returns false when seer-added is present', () => {
      const organization = OrganizationFixture({
        features: ['seer-added'],
      });

      expect(showNewSeer(organization)).toBe(false);
    });

    it('returns false even with launch flags when seer-added is present', () => {
      const organization = OrganizationFixture({
        features: ['seer-added', 'seer-user-billing', 'seer-user-billing-launch'],
      });

      expect(showNewSeer(organization)).toBe(false);
    });
  });

  describe('code-review-beta trial', () => {
    it('returns false when code-review-beta is present', () => {
      const organization = OrganizationFixture({
        features: ['code-review-beta'],
      });

      expect(showNewSeer(organization)).toBe(false);
    });

    it('returns false even with launch flags when code-review-beta is present', () => {
      const organization = OrganizationFixture({
        features: ['code-review-beta', 'seer-user-billing', 'seer-user-billing-launch'],
      });

      expect(showNewSeer(organization)).toBe(false);
    });
  });

  describe('seer-user-billing-launch flag', () => {
    it('returns true when both seer-user-billing and seer-user-billing-launch are present', () => {
      const organization = OrganizationFixture({
        features: ['seer-user-billing', 'seer-user-billing-launch'],
      });

      expect(showNewSeer(organization)).toBe(true);
    });

    it('returns false when only seer-user-billing is present', () => {
      const organization = OrganizationFixture({
        features: ['seer-user-billing'],
      });

      expect(showNewSeer(organization)).toBe(false);
    });

    it('returns false when only seer-user-billing-launch is present', () => {
      const organization = OrganizationFixture({
        features: ['seer-user-billing-launch'],
      });

      expect(showNewSeer(organization)).toBe(false);
    });
  });

  describe('no relevant features', () => {
    it('returns false when no Seer-related features are present', () => {
      const organization = OrganizationFixture({
        features: [],
      });

      expect(showNewSeer(organization)).toBe(false);
    });

    it('returns false with unrelated features', () => {
      const organization = OrganizationFixture({
        features: ['some-other-feature', 'another-feature'],
      });

      expect(showNewSeer(organization)).toBe(false);
    });
  });
});
