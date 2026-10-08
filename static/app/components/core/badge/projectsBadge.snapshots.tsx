// eslint-disable-next-line @sentry/scraps/no-core-import -- SSR snapshot needs direct import to avoid barrel re-exports with heavy deps
import {ProjectsBadge} from 'sentry/components/core/badge/projectsBadge';

/**
 * Only the cases that draw a Sentry icon are covered here.
 *
 * A badge with platforms renders `PlatformIcon`, which loads an SVG file from
 * the platformicons package. Snapshots map `.svg` to a stub and are captured
 * from `page.setContent` with nothing serving files, so those images come out
 * broken — baselining them would freeze a placeholder in place of the logo.
 * Covering them needs the snapshot config to inline SVGs as data URIs.
 */
describe('ProjectsBadge', () => {
  it.snapshot.each<'md' | 'lg'>(['md', 'lg'])(
    'no projects %s',
    size => (
      <div style={{padding: 8}}>
        <ProjectsBadge projectPlatforms={[]} size={size} />
      </div>
    ),
    size => ({tags: {size: String(size), area: 'core'}})
  );

  it.snapshot(
    'all projects',
    () => (
      <div style={{padding: 8}}>
        <ProjectsBadge projectPlatforms={[]} allProjects />
      </div>
    ),
    {tags: {area: 'core'}}
  );
});
