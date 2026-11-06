import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Button, ButtonBar} from '@sentry/scraps/button';
import {InlineCode} from '@sentry/scraps/code';
import {Kbd} from '@sentry/scraps/hotkey';
import {Stack} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
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

it('composes moved controls with the remaining app button barrel', () => {
  render(
    <ButtonBar size="sm">
      <Button>Save</Button>
      <Switch aria-label="Enabled" />
    </ButtonBar>
  );

  expect(screen.getByRole('button', {name: 'Save'})).toBeEnabled();
  expect(screen.getByRole('checkbox', {name: 'Enabled'})).not.toBeChecked();
});
