import {useState} from 'react';

import StructuredEventData, {StructuredData} from 'sentry/components/structuredEventData';
import storyBook from 'sentry/stories/storyBook';
import useOrganization from 'sentry/utils/useOrganization';

export default storyBook('useOrganization', story => {
  story('useOrganization - via StructuredEventData', () => {
    const org = useOrganization();
    const [state, setState] = useState<string[]>([]);

    console.log('render', state);

    return (
      <StructuredEventData
        data={org}
        onToggleExpand={(path, expandedPaths, collapseState) => {
          console.log({path, expandedPaths, collapseState});
          setState(expandedPaths);
        }}
      />
    );
  });

  story('useOrganization - via StructuredData', () => {
    const org = useOrganization();
    return (
      <StructuredData
        value={org}
        depth={0}
        maxDefaultDepth={0}
        meta={undefined}
        withAnnotatedText={false}
      />
    );
  });
});
