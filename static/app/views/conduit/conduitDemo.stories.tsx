import {useMemo, useState} from 'react';
import {useStream} from 'conduit-client';

import {Heading} from '@sentry/scraps/text';

import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout/flex';
import {Text} from 'sentry/components/core/text/text';
import * as Storybook from 'sentry/stories';
import getCsrfToken from 'sentry/utils/getCsrfToken';
import useOrganization from 'sentry/utils/useOrganization';

type Message = {
  value: string;
};

export default Storybook.story('Conduit Demo', story => {
  story('Streaming Demo', () => {
    const organization = useOrganization();
    const [messages, setMessages] = useState<Message[]>([]);
    const [isEnabled, setIsEnabled] = useState(false);

    const streamUrl = `/api/0/organizations/${organization.slug}/conduit-demo/`;

    const streamHeaders = useMemo(
      () => ({
        'X-CSRFToken': getCsrfToken(),
      }),
      []
    );

    const {error, isConnected} = useStream({
      enabled: isEnabled,
      orgId: Number(organization.id),
      startStreamUrl: streamUrl,
      startStreamHeaders: streamHeaders,
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
      <Flex direction="column" gap="lg" padding="lg" align="start">
        <Heading as="h1">Conduit Demo</Heading>
        <Button priority="primary" size="md" onClick={() => setIsEnabled(prev => !prev)}>
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
      </Flex>
    );
  });
});
