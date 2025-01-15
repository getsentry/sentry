import type {ComponentProps} from 'react';
import {Fragment} from 'react';

import {Button} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import JSXProperty from 'sentry/components/stories/jsxProperty';
import type {PropMatrix} from 'sentry/components/stories/matrix';
import Matrix from 'sentry/components/stories/matrix';
import {IconLink} from 'sentry/icons';
import storyBook from 'sentry/stories/storyBook';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

export default storyBook(CopyToClipboardButton, story => {
  story('Basic', () => (
    <Fragment>
      <p>
        By default the button will stick the <JSXProperty name="text" value={String} />{' '}
        value onto your clipboard; as if you typed <kbd>CTRL+C</kbd> or <kbd>CMD+C</kbd>.
        It&apos;ll show toast messages, and includes{' '}
        <JSXProperty name="onCopy" value={Function} /> &
        <JSXProperty name="onError" value={Function} /> callbacks.
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
          There&apos;s also a hook you can use to get the same behavior and apply it to
          any other component.
        </p>
        <p>Here&apos;s an example where I&apos;ve chosen a different icon:</p>
        <Button icon={<IconLink />} aria-label={label} onClick={onClick} />
      </Fragment>
    );
  });

  const propMatrix: PropMatrix<ComponentProps<typeof CopyToClipboardButton>> = {
    size: [undefined, 'md', 'sm', 'xs', 'zero'],
    iconSize: [undefined, 'xs', 'sm', 'md', 'lg', 'xl', 'xxl'],
  };
  story('Size Props', () => (
    <Fragment>
      <p>
        Try to keep the <JSXProperty name="size" value="" /> and{' '}
        <JSXProperty name="iconSize" value="" /> props set to the same value. Here&apos;s
        a grid of all the possible combinations.
      </p>
      <Matrix
        render={CopyToClipboardButton}
        propMatrix={propMatrix}
        selectedProps={['size', 'iconSize']}
      />
    </Fragment>
  ));
});
