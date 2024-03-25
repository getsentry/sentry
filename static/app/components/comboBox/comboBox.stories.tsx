import {Fragment, useState} from 'react';

import {Button} from 'sentry/components/button';
import JSXNode from 'sentry/components/stories/jsxNode';
import SizingWindow from 'sentry/components/stories/sizingWindow';
import storyBook from 'sentry/stories/storyBook';

import {ComboBox} from './';

export default storyBook(ComboBox, story => {
  story('Default', () => {
    return (
      <Fragment>
        <p>
          The <JSXNode name="ComboBox" /> component allows users to select an option from
          a list of options by typing in an input field. From a user perspective it is
          basically a combination of an input field and a dropdown menu filled with
          suggestions.
        </p>
        <SizingWindow display="block" style={{height: '200px', width: '400px'}}>
          <ComboBox
            aria-label="ComboBox"
            menuTrigger="focus"
            options={[
              {label: 'Option One', value: 'opt_one'},
              {label: 'Option Two', value: 'opt_two'},
              {label: 'Option Three', value: 'opt_three'},
              {
                label: 'Others',
                options: [
                  {label: 'Option Four', value: 'opt_four'},
                  {label: 'Option Five', value: 'opt_five'},
                ],
              },
            ]}
          />
        </SizingWindow>
      </Fragment>
    );
  });

  story('Controlled', () => {
    const [value, setValue] = useState('opt_one');
    return (
      <Fragment>
        <SizingWindow display="block" style={{height: '200px', width: '400px'}}>
          <ComboBox
            value={value}
            onChange={({value: newValue}) => setValue(newValue)}
            aria-label="ComboBox"
            menuTrigger="focus"
            options={[
              {label: 'Option One', value: 'opt_one'},
              {label: 'Option Two', value: 'opt_two'},
              {label: 'Option Three', value: 'opt_three'},
              {
                label: 'Others',
                options: [
                  {label: 'Option Four', value: 'opt_four'},
                  {label: 'Option Five', value: 'opt_five'},
                ],
              },
            ]}
          />
          <hr />
          <Button onClick={() => setValue('opt_two')}>Select Option Two</Button>
        </SizingWindow>
      </Fragment>
    );
  });
});
