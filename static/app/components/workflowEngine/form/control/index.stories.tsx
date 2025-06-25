import {Fragment} from 'react';

import {Flex} from 'sentry/components/core/layout';
import Form from 'sentry/components/forms/form';
import PriorityControl from 'sentry/components/workflowEngine/form/control/priorityControl';
import * as Storybook from 'sentry/stories';
import {space} from 'sentry/styles/space';
import {DetectorPriorityLevel} from 'sentry/types/workflowEngine/dataConditions';

export default Storybook.story('Form Controls', story => {
  story('PriorityControl', () => (
    <Fragment>
      <p>
        The <Storybook.JSXNode name="PriorityControl" /> component allows users to
        configure issue priority when a Monitor matches specific thresholds.
      </p>

      <Form hideFooter>
        <Flex direction="column" gap={space(2)}>
          <PriorityControl minimumPriority={DetectorPriorityLevel.LOW} />
        </Flex>
      </Form>
    </Fragment>
  ));
});
