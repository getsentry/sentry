import {Fragment} from 'react';

import {Flex} from 'sentry/components/container/flex';
import Form from 'sentry/components/forms/form';
import PriorityControl from 'sentry/components/workflowEngine/form/control/priorityControl';
import {FormSection} from 'sentry/components/workflowEngine/form/section';
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
          <FormSection
            title="Prioritize"
            description="Update issue priority when the following thresholds are met:"
          >
            <PriorityControl name="priority" />
          </FormSection>

          <FormSection
            title="Prioritize"
            description="Sentry will automatically update priority."
          />
        </Flex>
      </Form>
    </Fragment>
  ));
});
