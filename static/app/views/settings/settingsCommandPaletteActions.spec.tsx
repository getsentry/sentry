import {IconSettings} from '@sentry/icons/settings';
import {IconUser} from '@sentry/icons/user';

import {getSettingsFieldSections} from 'sentry/views/settings/settingsCommandPaletteActions';

function getSection(sections: ReturnType<typeof getSettingsFieldSections>, key: string) {
  const section = sections.find(s => s.key === key);
  if (!section) {
    throw new Error(`No field section for ${key}`);
  }
  return section;
}

describe('getSettingsFieldSections', () => {
  it('names shared titles after their scope with settings-v3', () => {
    const sections = getSettingsFieldSections('org-slug', true);

    expect(getSection(sections, '/settings/:orgId/').title).toBe(
      'Org Settings › General'
    );
    expect(getSection(sections, '/settings/account/details/').title).toBe(
      'Account Settings › General'
    );
    // Titles unique to one scope are left alone.
    expect(getSection(sections, '/settings/account/notifications/').title).toBe(
      'Notifications'
    );
  });

  it('keeps the original titles without settings-v3', () => {
    const sections = getSettingsFieldSections('org-slug', false);

    expect(getSection(sections, '/settings/:orgId/').title).toBe('General Settings');
    expect(getSection(sections, '/settings/account/details/').title).toBe(
      'Account Details'
    );
  });

  it('gives both General pages the settings icon with settings-v3', () => {
    const v3Sections = getSettingsFieldSections('org-slug', true);
    expect(getSection(v3Sections, '/settings/:orgId/').icon).toEqual(<IconSettings />);
    expect(getSection(v3Sections, '/settings/account/details/').icon).toEqual(
      <IconSettings />
    );

    const sections = getSettingsFieldSections('org-slug', false);
    expect(getSection(sections, '/settings/account/details/').icon).toEqual(<IconUser />);
  });
});
