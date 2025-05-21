import {Fragment} from 'react';

import {Flex} from 'sentry/components/container/flex';
import * as Storybook from 'sentry/components/stories';
import CollapsibleSection from 'sentry/components/workflowEngine/ui/collapsibleSection';
import {space} from 'sentry/styles/space';

export default Storybook.story('Collapsible Section', story => {
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
