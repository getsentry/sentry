import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import type {AutofixExplorerStep} from 'sentry/components/events/autofix/useExplorerAutofix';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {IconList} from 'sentry/icons/iconList';
import {t} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * The autofix API reports steps by identifier; only the UI spells them out.
 */
function stepLabel(step: AutofixExplorerStep): string {
  const labels = {
    root_cause: t('Root Cause'),
    solution: t('Solution'),
    code_changes: t('Code Changes'),
    pr_iteration: t('Pull Request'),
  } satisfies Record<AutofixExplorerStep, string>;
  return labels[step];
}

interface AutofixContentProps extends Pick<Group, 'id' | 'shortId'> {
  /**
   * Markdown write-up for this step. Assembled by Seer rather than returned
   * verbatim by the autofix API, so it keeps a UI-facing name.
   */
  result: string;
  step: AutofixExplorerStep;
}

function AutofixContent({id, shortId, result, step}: AutofixContentProps) {
  const organization = useOrganization();
  return (
    <Disclosure>
      <Disclosure.Title
        trailingItems={
          <Link to={`/organizations/${organization.slug}/issues/${id}/`}>{shortId}</Link>
        }
      >
        <Flex gap="md">
          <IconList />
          <Text>{stepLabel(step)}</Text>
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
