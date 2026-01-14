import {Fragment, useState} from 'react';
import documentation from '!!type-loader!sentry/components/core/radio';

import {Flex} from '@sentry/scraps/layout';

import {Radio, type RadioProps} from 'sentry/components/core/radio';
import * as Storybook from 'sentry/stories';

export default Storybook.story('Radio', (story, APIReference) => {
  APIReference(documentation.props?.Radio);

  story('Default', () => {
    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="Radio" /> component is a switch component. It
          doesn't have any property to specify a text label, so you'll need to add your
          own accompanying label if you need one.
        </p>
        <p>
          Here we are specifying the label with an HTML <code>label</code> element, which
          is also accessibility friendly -- clicking the label also affects the toggle!
        </p>
        <p>
          <Storybook.JSXProperty name="size" value="md" />
        </p>
        <Storybook.SideBySide>
          <RadioCase checked />
          <RadioCase checked={false} disabled />
          <RadioCase checked disabled />
        </Storybook.SideBySide>

        <p>
          <Storybook.JSXProperty name="size" value="sm" />
        </p>
        <Storybook.SideBySide>
          <RadioCase checked size="sm" />
          <RadioCase checked={false} disabled size="sm" />
          <RadioCase checked disabled size="sm" />
        </Storybook.SideBySide>
      </Fragment>
    );
  });
});

function RadioCase(props: RadioProps) {
  const [checked, setChecked] = useState(!!props.checked);
  const {checked: _checkedProp, ...rest} = props;
  return (
    <Flex as="label" align="center" gap="md">
      {checked
        ? `Radio is on ${props.disabled ? '(disabled)' : ''}`
        : `Radio is off ${props.disabled ? '(disabled)' : ''}`}
      <Radio checked={checked} onClick={() => setChecked(!checked)} {...rest} />
    </Flex>
  );
}
