import {useState} from 'react';

import {Input} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {PasswordStrengthRing} from 'sentry/components/passwordStrength';
import * as Storybook from 'sentry/stories';

export default Storybook.story('PasswordStrengthRing', story => {
  story('Interactive', () => <InteractivePasswordStrength />);
});

function InteractivePasswordStrength() {
  const [password, setPassword] = useState('');

  return (
    <Stack gap="md" maxWidth="360px">
      <Text as="p">The ring shows the password grade as you type.</Text>
      <Flex align="center" gap="sm">
        <Input
          type="password"
          aria-label="Password"
          value={password}
          onChange={event => setPassword(event.target.value)}
        />
        <PasswordStrengthRing value={password} />
      </Flex>
    </Stack>
  );
}
