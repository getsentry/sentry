import {Fragment} from 'react';

import {Flex} from 'sentry/components/container/flex';
import Form from 'sentry/components/forms/form';
import PriorityControl from 'sentry/components/workflowEngine/form/control/priorityControl';
import * as Storybook from 'sentry/stories';
import {space} from 'sentry/styles/space';

export default Storybook.story('Form Controls', story => {
  story('PriorityControl', () => (
    <Fragment>
      <p>
        The <Storybook.JSXNode name="PriorityControl" /> component allows users to
        configure issue priority when a Monitor matches specific thresholds.
      </p>

      <Form hideFooter>
        <Flex column gap={space(2)}>
          <PriorityControl />
        </Flex>
      </Form>
    </Fragment>
  ));
});
