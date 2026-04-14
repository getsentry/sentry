import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {getProjectSettingsCommandPaletteSections} from 'sentry/views/settings/project/projectSettingsCommandPaletteActions';

describe('ProjectSettingsCommandPaletteActions', () => {
  it('returns current project settings sections with visibility rules applied', () => {
    const organization = OrganizationFixture({
      access: ['project:write'],
      features: ['performance-view'],
      slug: 'acme',
    });
    const project = ProjectFixture({
      slug: 'frontend',
      plugins: [
        {enabled: true, id: 'github', isDeprecated: false, name: 'GitHub'},
        {enabled: true, id: 'legacy', isDeprecated: true, name: 'Legacy Plugin'},
      ],
    });

    const sections = getProjectSettingsCommandPaletteSections({organization, project});

    expect(sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Project',
          items: expect.arrayContaining([
            expect.objectContaining({
              display: expect.objectContaining({label: 'General Settings'}),
              to: '/settings/acme/projects/frontend/',
            }),
          ]),
        }),
        expect.objectContaining({
          label: 'Processing',
          items: expect.arrayContaining([
            expect.objectContaining({
              display: expect.objectContaining({label: 'Performance'}),
              to: '/settings/acme/projects/frontend/performance/',
            }),
          ]),
        }),
        expect.objectContaining({
          label: 'Legacy Integrations',
          items: expect.arrayContaining([
            expect.objectContaining({
              display: expect.objectContaining({label: 'GitHub'}),
              to: '/settings/acme/projects/frontend/plugins/github/',
            }),
          ]),
        }),
      ])
    );

    expect(sections).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({to: '/settings/acme/projects/frontend/replays/'}),
          ]),
        }),
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({
              to: '/settings/acme/projects/frontend/plugins/legacy/',
            }),
          ]),
        }),
      ])
    );
  });
});
