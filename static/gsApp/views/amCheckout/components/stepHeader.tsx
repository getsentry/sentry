import kebabCase from 'lodash/kebabCase';

import {Heading} from '@sentry/scraps/text';

type Props = {
  title: string;
};

export function StepHeader({title}: Props) {
  const dataTestId = `header-${kebabCase(title)}`;

  return (
    <Heading as="h2" size="2xl" data-test-id={dataTestId}>
      {title}
    </Heading>
  );
}
