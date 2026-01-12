import kebabCase from 'lodash/kebabCase';

import {Heading} from 'sentry/components/core/text';

type Props = {
  title: string;
};

function StepHeader({title}: Props) {
  const dataTestId = `header-${kebabCase(title)}`;

  return (
    <Heading as="h2" size="2xl" data-test-id={dataTestId}>
      {title}
    </Heading>
  );
}

export default StepHeader;
