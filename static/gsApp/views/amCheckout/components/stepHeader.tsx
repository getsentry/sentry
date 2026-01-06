import kebabCase from 'lodash/kebabCase';

import {Flex} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text';

type Props = {
  stepNumber: number;
  title: string;
};

function StepHeader({title, stepNumber}: Props) {
  const dataTestId = `header-${kebabCase(title)}`;

  return (
    <Flex justify="between" align="center">
      <Flex justify="start" align="center" gap="sm" width="100%">
        <Heading as="h2" size="2xl" id={`step-${stepNumber}`} data-test-id={dataTestId}>
          {title}
        </Heading>
      </Flex>
    </Flex>
  );
}

export default StepHeader;
