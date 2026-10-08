// eslint-disable-next-line @sentry/scraps/no-core-import -- SSR snapshot needs direct import to avoid barrel re-exports with heavy deps
import {ProjectsBadge} from 'sentry/components/core/badge/projectsBadge';

const platforms = {
  none: [],
  one: ['javascript'],
  two: ['javascript', 'python'],
};

describe('ProjectsBadge', () => {
  it.snapshot.each<keyof typeof platforms>(['none', 'one', 'two'])(
    'md %s',
    count => (
      <div style={{padding: 8}}>
        <ProjectsBadge projectPlatforms={platforms[count]} />
      </div>
    ),
    count => ({tags: {size: 'md', platforms: String(count), area: 'core'}})
  );

  it.snapshot.each<keyof typeof platforms>(['none', 'one', 'two'])(
    'lg %s',
    count => (
      <div style={{padding: 8}}>
        <ProjectsBadge projectPlatforms={platforms[count]} size="lg" />
      </div>
    ),
    count => ({tags: {size: 'lg', platforms: String(count), area: 'core'}})
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
