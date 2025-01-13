import {Fragment} from 'react';

import StructuredEventData from 'sentry/components/structuredEventData';
import storyBook from 'sentry/stories/storyBook';
import useOrganization from 'sentry/utils/useOrganization';

export default storyBook('useOrganization', story => {
  story('Default', () => {
    const org = useOrganization();

    // Sort features and access alphabetically for the story use case
    org.features.sort((a, b) => a.localeCompare(b));
    org.access.sort((a, b) => a.localeCompare(b));

    return (
      <Fragment>
        <p>
          <code>useOrganization</code> returns the currently selected organization.
        </p>
        In the context of the Sentry dashboard, only a single organization can be selected
        at a time.
        <p>
          A common need to use <code>useOrganization</code> is to check for feature flags
          via <code>organization.features.includes(feature)</code>. Note that our feature
          names are currently not typed, so you need to make sure you pass in the correct
          feature name.
        </p>
        <StructuredEventData data={org} />
      </Fragment>
    );
  });
});
