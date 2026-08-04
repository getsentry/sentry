import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {IconList} from 'sentry/icons/iconList';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {useOrganization} from 'sentry/utils/useOrganization';

function AutofixContent({
  issue_short_id,
  issue_id,
  result,
  step,
}: {
  issue_id: string;
  issue_short_id: string;
  result: string;
  step: string;
}) {
  const organization = useOrganization();
  return (
    <Disclosure>
      <Disclosure.Title
        trailingItems={
          <Link to={`/organizations/${organization.slug}/issues/${issue_id}/`}>
            {issue_short_id}
          </Link>
        }
      >
        <Flex gap="md">
          <IconList />
          <Text>{step}</Text>
        </Flex>
      </Disclosure.Title>
      <Disclosure.Content>
        <MarkedText text={result} />
      </Disclosure.Content>
    </Disclosure>
  );
}

export const Autofix = defineSeerEmbed({
  name: 'autofix',
  render(props) {
    return <AutofixContent {...props} />;
  },
});
