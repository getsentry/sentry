import {OrganizationFixture} from 'sentry-fixture/organization';
import {PluginFixture} from 'sentry-fixture/plugin';
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
        PluginFixture({enabled: true, id: 'github', isDeprecated: false, name: 'GitHub'}),
        PluginFixture({
          enabled: true,
          id: 'legacy',
          isDeprecated: true,
          name: 'Legacy Plugin',
        }),
      ],
    });

    const sections = getProjectSettingsCommandPaletteSections({organization, project});

    expect(sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Project Settings',
          items: expect.arrayContaining([
            expect.objectContaining({
              label: 'General',
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
              label: 'SDK setup',
            }),
            expect.objectContaining({
              display: expect.objectContaining({label: 'Legacy Integrations'}),
              to: '/settings/acme/projects/frontend/plugins/',
            }),
          ]),
        }),
      ])
    );

    expect(sections).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Project Settings',
          items: expect.arrayContaining([
            expect.objectContaining({
              label: 'Processing',
              items: expect.arrayContaining([
                expect.objectContaining({
                  to: '/settings/acme/projects/frontend/replays/',
                }),
              ]),
            }),
          ]),
        }),
      ])
    );

    expect(sections).not.toEqual(
      expect.arrayContaining([
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
