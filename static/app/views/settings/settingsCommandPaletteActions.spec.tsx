import {IconBuilding} from '@sentry/icons/building';
import {IconUser} from '@sentry/icons/user';

import {getSettingsFieldSections} from './settingsCommandPaletteActions';

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
      'Organization Settings › General'
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

  it.each([true, false])(
    'gives the General pages their scope icon (settings-v3: %s)',
    settingsV3 => {
      const sections = getSettingsFieldSections('org-slug', settingsV3);
      expect(getSection(sections, '/settings/:orgId/').icon).toEqual(<IconBuilding />);
      expect(getSection(sections, '/settings/account/details/').icon).toEqual(
        <IconUser />
      );
    }
  );
});
