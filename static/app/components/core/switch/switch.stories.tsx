import {Fragment, useState} from 'react';
import documentation from '!!type-loader!sentry/components/core/switch';
import styled from '@emotion/styled';

import {Switch, type SwitchProps} from 'sentry/components/core/switch';
import * as Storybook from 'sentry/stories';
import {space} from 'sentry/styles/space';

export default Storybook.story('Switch', (story, APIReference) => {
  APIReference(documentation.props?.Switch);

  story('Default', () => {
    return (
      <Fragment>
        <p>
          The <Storybook.JSXNode name="Switch" /> component is a checkbox button. It
          doesn't have any property to specify a text label, so you'll need to add your
          own accompanying label if you need one.
        </p>
        <p>
          Here we are specifying the label with an HTML <code>label</code> element, which
          is also accessibility friendly -- clicking the label also affects the toggle!
        </p>
        <p>
          <Storybook.JSXProperty name="size" value="lg" />
        </p>
        <Storybook.SideBySide>
          <SwitchCase checked size="lg" />
          <SwitchCase checked={false} disabled size="lg" />
          <SwitchCase checked disabled size="lg" />
        </Storybook.SideBySide>

        <p>
          <Storybook.JSXProperty name="size" value="sm" />
        </p>
        <Storybook.SideBySide>
          <SwitchCase checked />
          <SwitchCase checked={false} disabled />
          <SwitchCase checked disabled />
        </Storybook.SideBySide>
      </Fragment>
    );
  });
});

function SwitchCase(props: SwitchProps) {
  const [checked, setChecked] = useState(!!props.checked);
  const {checked: _checkedProp, ...rest} = props;
  return (
    <Label>
      {checked
        ? `Switch is on ${props.disabled ? '(disabled)' : ''}`
        : `Switch is off ${props.disabled ? '(disabled)' : ''}`}
      <Switch checked={checked} onChange={() => setChecked(!checked)} {...rest} />
    </Label>
  );
}

const Label = styled('label')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
