import {GroupStatusTag} from './groupStatusTag';

describe('GroupStatusTag', () => {
  it.snapshot.each<'sm' | 'md'>(['sm', 'md'])(
    'fontSize-%s',
    fontSize => (
      <div style={{padding: 8}}>
        <GroupStatusTag fontSize={fontSize}>Ongoing</GroupStatusTag>
      </div>
    ),
    fontSize => ({tags: {area: 'core', fontSize}})
  );
});
