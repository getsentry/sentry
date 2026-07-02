import {OrganizationFixture} from 'sentry-fixture/organization';
import {DetailedProjectFixture} from 'sentry-fixture/project';

import {getProjectSettingsCommandPaletteSections} from 'sentry/views/settings/project/projectSettingsCommandPaletteActions';

describe('ProjectSettingsCommandPaletteActions', () => {
  it('returns current project settings sections with visibility rules applied', () => {
    const organization = OrganizationFixture({
      access: ['project:write'],
      features: ['performance-view'],
      slug: 'acme',
    });
    const project = DetailedProjectFixture({
      slug: 'frontend',
    });

    const sections = getProjectSettingsCommandPaletteSections({organization, project});

    expect(sections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'frontend',
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
              display: expect.objectContaining({label: 'Webhooks (Legacy)'}),
              to: '/settings/acme/projects/frontend/legacy-webhooks/',
            }),
          ]),
        }),
      ])
    );

    expect(sections).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'frontend',
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
  });
});
