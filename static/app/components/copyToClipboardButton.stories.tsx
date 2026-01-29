import {Fragment} from 'react';

import {Button} from '@sentry/scraps/button';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
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

      <CopyToClipboardButton text="Hello World" aria-label={t('Copy to clipboard')} />
    </Fragment>
  ));

  story('useCopyToClipboard()', () => {
    const {copy} = useCopyToClipboard();

    return (
      <Fragment>
        <p>
          There's also a hook you can use to get the same behavior and apply it to any
          other component.
        </p>
        <p>Here's an example where I've chosen a different icon:</p>
        <Button
          icon={<IconLink />}
          aria-label="Copy to clipboard"
          onClick={() =>
            copy('Hello World', {
              successMessage: 'Copied to clipboard',
              errorMessage: 'Failed to copy to clipboard',
            })
          }
        />
      </Fragment>
    );
  });
});
