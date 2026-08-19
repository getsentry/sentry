import {useState} from 'react';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useConduitStream} from 'sentry/utils/useConduitStream';
import {useOrganization} from 'sentry/utils/useOrganization';

type Message = {
  value: string;
};

export default Storybook.story('Conduit Demo', story => {
  story('Streaming Demo', () => {
    const organization = useOrganization();
    const [messages, setMessages] = useState<Message[]>([]);
    const [isEnabled, setIsEnabled] = useState(false);

    const {error, isConnected} = useConduitStream({
      enabled: isEnabled,
      queryOptions: apiOptions.as<unknown>()(
        '/organizations/$organizationIdOrSlug/conduit-demo/',
        {
          path: {organizationIdOrSlug: organization.slug},
          method: 'POST',
          staleTime: 0,
        }
      ),
      onMessage: (message: Message) => {
        setMessages(prev => [...prev, message]);
      },
      onConnect: () => {
        setMessages([]);
      },
      onClose: () => {
        setIsEnabled(false);
      },
    });

    const fullMessage = messages.map(msg => msg.value).join(' ');

    return (
      <Stack gap="lg" padding="lg" align="start">
        <Heading as="h1">Conduit Demo</Heading>
        <Button variant="primary" size="md" onClick={() => setIsEnabled(prev => !prev)}>
          {isEnabled ? 'Disable' : 'Enable'}
        </Button>
        <Text variant={isConnected ? 'success' : 'muted'}>
          {isConnected ? 'Connected' : 'Disconnected'}
        </Text>
        {error && <Text variant="danger">Error: {error.message}</Text>}
        {fullMessage && (
          <Text as="div" size="sm" monospace>
            {fullMessage}
          </Text>
        )}
      </Stack>
    );
  });
});
