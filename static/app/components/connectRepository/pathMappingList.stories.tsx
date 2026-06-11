import {useState} from 'react';

import type {PathMappingValue} from 'sentry/components/connectRepository/pathMapping';
import {PathMappingList} from 'sentry/components/connectRepository/pathMappingList';
import * as Storybook from 'sentry/stories';

export default Storybook.story('PathMappingList', story => {
  story('Empty (starts with a new path)', () => {
    const [pathMappings, setPathMappings] = useState<PathMappingValue[]>([]);

    return <PathMappingList pathMappings={pathMappings} onChange={setPathMappings} />;
  });

  story('With existing paths', () => {
    const [pathMappings, setPathMappings] = useState([
      {stackRoot: 'app/', sourceRoot: 'static/app/', branch: 'main'},
      {stackRoot: 'src/', sourceRoot: 'src/app/', branch: 'frontend'},
    ]);

    return <PathMappingList pathMappings={pathMappings} onChange={setPathMappings} />;
  });
});
