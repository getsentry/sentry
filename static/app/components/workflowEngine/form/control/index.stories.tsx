import {Fragment} from 'react';

import {Flex} from 'sentry/components/container/flex';
import Form from 'sentry/components/forms/form';
import JSXNode from 'sentry/components/stories/jsxNode';
import PriorityControl from 'sentry/components/workflowEngine/form/control/priorityControl';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

export default storyBook('Form Controls', story => {
  story('PriorityControl', () => (
    <Fragment>
      <p>
        The <JSXNode name="PriorityControl" /> component allows users to configure issue
        priority when a Monitor matches specific thresholds.
      </p>

      <Form hideFooter>
        <Flex column gap={space(2)}>
          <PriorityControl name="priority" />
        </Flex>
      </Form>
    </Fragment>
  ));
});
