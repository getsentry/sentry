import {OrganizationFixture} from 'sentry-fixture/organization';

import {ConfigStore} from 'sentry/stores/configStore';
import {areAiFeaturesAllowed} from 'sentry/utils/seer/areAiFeaturesAllowed';

describe('areAiFeaturesAllowed', () => {
  beforeEach(() => {
    ConfigStore.set('isSelfHosted', false);
  });

  it('allows when not hidden and not self-hosted', () => {
    const organization = OrganizationFixture({hideAiFeatures: false});
    expect(areAiFeaturesAllowed(organization)).toBe(true);
  });

  it('denies when the org hides AI features', () => {
    const organization = OrganizationFixture({hideAiFeatures: true});
    expect(areAiFeaturesAllowed(organization)).toBe(false);
  });

  it('denies on self-hosted', () => {
    ConfigStore.set('isSelfHosted', true);
    const organization = OrganizationFixture({hideAiFeatures: false});
    expect(areAiFeaturesAllowed(organization)).toBe(false);
  });
});
