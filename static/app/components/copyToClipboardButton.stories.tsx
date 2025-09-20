import {Fragment} from 'react';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {Button} from 'sentry/components/core/button';
import {IconLink} from 'sentry/icons';
import * as Storybook from 'sentry/stories';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

export default Storybook.story('CopyToClipboardButton', story => {
  story('Basic', () => (
    <Fragment>
      <p>
        By default the button will stick the{' '}
        <Storybook.JSXProperty name="text" value={String} /> value onto your clipboard; as
        if you typed <kbd>CTRL+C</kbd> or <kbd>CMD+C</kbd>. It'll show toast messages, and
        includes <Storybook.JSXProperty name="onCopy" value={Function} /> &
        <Storybook.JSXProperty name="onError" value={Function} /> callbacks.
      </p>

      <CopyToClipboardButton text="Hello World" />
    </Fragment>
  ));

  story('useCopyToClipboard()', () => {
    const {onClick, label} = useCopyToClipboard({
      text: 'Hello World',
      // eslint-disable-next-line no-console
      onCopy: () => console.log('Copy complete'),
      // eslint-disable-next-line no-console
      onError: error => console.log('Something went wrong', error),
    });

    return (
      <Fragment>
        <p>
          There's also a hook you can use to get the same behavior and apply it to any
          other component.
        </p>
        <p>Here's an example where I've chosen a different icon:</p>
        <Button icon={<IconLink />} aria-label={label} onClick={onClick} />
      </Fragment>
    );
  });
});
