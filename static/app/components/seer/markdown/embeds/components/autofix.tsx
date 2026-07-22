import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {IconList} from 'sentry/icons/iconList';

export const Autofix = defineSeerEmbed({
  name: 'autofix',
  render({issue_short_id, issue_id, result, step}) {
    return (
      <Disclosure>
        <Disclosure.Title
          trailingItems={<Link to={`/issues/${issue_id}`}>{issue_short_id}</Link>}
        >
          <Flex gap="md">
            <IconList />
            <Text>{step}</Text>
          </Flex>
        </Disclosure.Title>
        <Disclosure.Content>
          <p>{result}</p>
        </Disclosure.Content>
      </Disclosure>
    );
  },
});
