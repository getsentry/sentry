import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {useServiceWorker} from 'sentry/serviceWorker/client/serviceWorkerContext';
import * as Storybook from 'sentry/stories';

export default Storybook.story('ServiceWorker', story => {
  story('Basic Events', () => {
    const {controller} = useServiceWorker();

    return (
      <Stack gap="md">
        <Flex>
          <Button onClick={() => controller.postMessage({name: 'ping', type: 'event'})}>
            Send Ping event
          </Button>
        </Flex>
        <Text>Look in the console for the ping event.</Text>
      </Stack>
    );
  });
});
