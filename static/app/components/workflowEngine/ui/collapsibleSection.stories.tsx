import {Fragment} from 'react';

import {Flex} from 'sentry/components/container/flex';
import CollapsibleSection from 'sentry/components/workflowEngine/ui/collapsibleSection';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

export default storyBook('Collapsible Section', story => {
  story('Basics', () => (
    <Fragment>
      <p>
        The <code>CollapsibleSection</code> component can be customized to start open or
        closed by setting <code>open</code>. By default, collapsible sections are
        collapsed.
      </p>
    </Fragment>
  ));
  story('Simple', () => (
    <Flex column gap={space(2)}>
      <CollapsibleSection
        title="Collapsed Section"
        description="Your optional description here"
      >
        <p>Child components go here</p>
      </CollapsibleSection>
      <CollapsibleSection
        title="Static Section"
        description="Your optional description here"
        open
      >
        <p>This section starts expanded!</p>
      </CollapsibleSection>
    </Flex>
  ));
});
