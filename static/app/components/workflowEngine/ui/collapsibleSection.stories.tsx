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
        closed by setting <code>initialCollapse</code>. By default, collapsible sections
        are collapsed.
      </p>

      <p>
        A static section can be created by setting <code>collapsible</code> to{' '}
        <code>false</code>. A static section can not be collapsed.
      </p>
    </Fragment>
  ));
  story('Simple', () => (
    <Flex column gap={space(2)}>
      <CollapsibleSection
        title="Collapsed Section"
        description="Your optional description here"
        collapsible
      >
        <p>Child components go here</p>
      </CollapsibleSection>
      <CollapsibleSection
        title="Static Section"
        description="Your optional description here"
        collapsible={false}
      >
        <p>This static section will always be expanded!</p>
      </CollapsibleSection>
    </Flex>
  ));
});
