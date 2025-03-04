import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Switch} from 'sentry/components/core/switch';
import JSXNode from 'sentry/components/stories/jsxNode';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import storyBook from 'sentry/stories/storyBook';
import {space} from 'sentry/styles/space';

// eslint-disable-next-line import/no-webpack-loader-syntax
import types from '!!type-loader!sentry/components/core/switch';

export default storyBook('Switch', (story, APIReference) => {
  APIReference(types.Switch);
  story('Default', () => {
    const [toggleOn, setToggleOn] = useState(false);
    return (
      <Fragment>
        <p>
          The <JSXNode name="Switch" /> component is a toggle button. It doesn't have any
          property to specify a text label, so you'll need to add your own accompanying
          label if you need one.
        </p>
        <p>
          Here we are specifying the label with an HTML <code>label</code> element, which
          is also accessibility friendly -- clicking the label also affects the toggle!
        </p>
        <Label htmlFor="switch">
          {toggleOn ? 'Switch is on' : 'Switch is off'}
          <Switch id="switch" toggle={() => setToggleOn(!toggleOn)} checked={toggleOn} />
        </Label>
        <p>
          You can pass a callback function into the <JSXProperty name="toggle" value />{' '}
          prop to control what happens when the toggle is clicked. Pair this with a{' '}
          <code>useState</code> or some other code to set the active state of the toggle,
          which is controlled by the prop <JSXProperty name="checked" value />.
        </p>
      </Fragment>
    );
  });

  story('Size', () => {
    const [toggleOnL, setToggleOnL] = useState(false);
    const [toggleOnS, setToggleOnS] = useState(false);

    return (
      <Fragment>
        <p>
          The <JSXProperty name="size" value /> prop has two options: <code>"sm"</code>{' '}
          and <code>"lg"</code>. The default value is <code>"sm"</code>.
        </p>
        <Label htmlFor="lg-switch">
          Large switch
          <Switch
            id="lg-switch"
            toggle={() => setToggleOnL(!toggleOnL)}
            size="lg"
            checked={toggleOnL}
          />
        </Label>
        <Label htmlFor="sm-switch">
          Small switch
          <Switch
            id="sm-switch"
            toggle={() => setToggleOnS(!toggleOnS)}
            size="sm"
            checked={toggleOnS}
          />
        </Label>
      </Fragment>
    );
  });
});

const Label = styled('label')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
