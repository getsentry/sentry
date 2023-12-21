import {Release as ReleaseFixture} from 'sentry-fixture/release';

import {initializeOrg} from 'sentry-test/initializeOrg';

import {lightTheme} from 'sentry/utils/theme';
import {
  generateReleaseMarkLines,
  releaseMarkLinesLabels,
} from 'sentry/views/releases/detail/utils';

describe('releases/detail/utils', () => {
  describe('generateReleaseMarkLines', () => {
    const {created, adopted, unadopted} = releaseMarkLinesLabels;
    const {router} = initializeOrg();
    const release = ReleaseFixture();
    const project = release.projects[0];

    it('generates "Created" markline', () => {
      const marklines = generateReleaseMarkLines(
        release,
        project,
        lightTheme,
        router.location
      );

      expect(marklines.map(markline => markline.seriesName)).toEqual([created]);
    });

    it('generates also Adoption marklines if exactly one env is selected', () => {
      const marklines = generateReleaseMarkLines(release, project, lightTheme, {
        ...router.location,
        query: {environment: 'prod'},
      });

      expect(marklines).toEqual([
        expect.objectContaining({
          seriesName: created,
          data: [
            {
              name: 1584925320000,
              value: null,
            },
          ],
        }),
        expect.objectContaining({
          seriesName: adopted,
          data: [
            {
              name: 1585011750000,
              value: null,
            },
          ],
        }),
        expect.objectContaining({
          seriesName: unadopted,
          data: [
            {
              name: 1585015350000,
              value: null,
            },
          ],
        }),
      ]);
    });

    it('does not generate Adoption marklines for non-mobile projects', () => {
      const marklines = generateReleaseMarkLines(
        {...release, projects: [{...release.projects[0], platform: 'javascript'}]},
        {...project, platform: 'javascript'},
        lightTheme,
        {
          ...router.location,
          query: {environment: 'prod'},
        }
      );

      expect(marklines.map(markline => markline.seriesName)).toEqual([created]);
    });

    it('shows only marklines that are in current time window', () => {
      const marklines = generateReleaseMarkLines(release, project, lightTheme, {
        ...router.location,
        query: {
          environment: 'prod',
          pageStart: '2020-03-24T01:00:30Z',
          pageEnd: '2020-03-24T01:03:30Z',
        },
      });

      expect(marklines.map(markline => markline.seriesName)).toEqual([adopted]);
    });

    it('does not generate out-of-bounds marklines on ancient/clamped releases', () => {
      const marklines = generateReleaseMarkLines(
        {...release, dateCreated: '2010-03-24T01:00:30Z'},
        project,
        lightTheme,
        router.location
      );

      expect(marklines).toEqual([]);
    });
  });
});
