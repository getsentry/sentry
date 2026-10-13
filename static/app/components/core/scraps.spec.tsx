import {render, screen} from 'sentry-test/reactTestingLibrary';

import {InlineCode} from '@sentry/scraps/code';
import {Kbd} from '@sentry/scraps/hotkey';
import {Stack} from '@sentry/scraps/layout';
import {Prose, Text} from '@sentry/scraps/text';

it('composes package components through the remaining core barrels', () => {
  render(
    <Stack>
      <Prose>
        <Text>Package text</Text>
        <InlineCode>Package code</InlineCode>
        <Kbd>Package key</Kbd>
      </Prose>
    </Stack>
  );

  expect(screen.getByText('Package text')).toBeInTheDocument();
  expect(screen.getByText('Package code').tagName).toBe('CODE');
  expect(screen.getByText('Package key').tagName).toBe('KBD');
});
