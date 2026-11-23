import type {ComponentProps} from 'react';

import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Toast, type ToastVariant} from '@sentry/scraps/toast';

function ExampleToast({
  width = 400,
  ...props
}: ComponentProps<typeof Toast> & {width?: number}) {
  return (
    <Text as="div">
      <Container padding="xl">
        <Container width={`${width}px`}>
          <Toast {...props} />
        </Container>
      </Container>
    </Text>
  );
}

describe('Toast', () => {
  it.snapshot.each<ToastVariant>(['default', 'success', 'error', 'loading'])(
    '%s',
    variant => (
      <ExampleToast variant={variant} message="A toast message." onDismiss={() => {}} />
    ),
    variant => ({tags: {area: 'core', variant}})
  );

  describe.each([
    {
      label: 'long message',
      message:
        'This is a long toast message that should wrap onto multiple lines instead of being truncated.',
    },
    {
      label: 'unbroken word',
      message:
        'ThisIsAnUnbrokenToastMessageThatMustWrapWithoutOverflowingOrHidingTheDismissButton',
    },
  ])('$label', ({message}) => {
    it.snapshot.each([240, 400])(
      'width %s',
      width => (
        <ExampleToast
          variant="default"
          message={message}
          width={width}
          onDismiss={() => {}}
        />
      ),
      width => ({tags: {area: 'core', width: String(width)}})
    );
  });
});
