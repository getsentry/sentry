import {useStore} from 'zustand';

import {Badge} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Tooltip} from '@sentry/scraps/tooltip';

import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import type {Mailbox} from 'sentry/components/feedback/useMailbox';
import {t, tct} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {useOrganization} from 'sentry/utils/useOrganization';

import {useMailboxCounts} from './useMailboxCounts';

interface Props {
  onChange: (next: Mailbox) => void;
  value: Mailbox;
}

export function MailboxPicker({onChange, value}: Props) {
  const organization = useOrganization();
  const {data} = useMailboxCounts({organization});
  const isSelfHosted = useStore(ConfigStore, state => state.isSelfHosted);

  const {areAiFeaturesAllowed} = useOrganizationSeerSetup();
  const hasSpamFeature = organization.features.includes('user-feedback-spam-ingest');

  const getSpamTooltip = () => {
    if (!hasSpamFeature || isSelfHosted) {
      return;
    }

    if (!areAiFeaturesAllowed) {
      return tct(
        'Generative AI Features are required for auto spam detection. Check that [linkGenAI:Generative AI Features] are toggled on.',
        {
          linkGenAI: (
            <Link
              to={{
                pathname: `/settings/${organization.slug}/`,
                hash: 'hideAiFeatures',
              }}
            />
          ),
        }
      );
    }

    return;
  };

  const MAILBOXES = [
    {key: 'unresolved', label: t('Inbox'), tooltip: undefined},
    {key: 'resolved', label: t('Resolved'), tooltip: undefined},
    {
      key: 'ignored',
      label: t('Spam'),
      tooltip: getSpamTooltip(),
    },
  ] as const;

  const filteredMailboxes = MAILBOXES;

  return (
    <Flex justify="end" flex="1 0 auto">
      <SegmentedControl
        size="xs"
        aria-label={t('Filter feedback')}
        value={value}
        onChange={onChange}
      >
        {filteredMailboxes.map(mailbox => {
          const count = data?.[mailbox.key];
          const display = count && count >= 100 ? '99+' : count;
          const title =
            count === 1 ? t('1 unassigned item') : t('%s unassigned items', display);
          return (
            <SegmentedControl.Item key={mailbox.key} aria-label={mailbox.label}>
              <Tooltip disabled={!count} title={title}>
                <Flex align="center" gap="sm">
                  {mailbox.tooltip ? (
                    <Tooltip title={mailbox.tooltip}>{mailbox.label}</Tooltip>
                  ) : (
                    mailbox.label
                  )}
                  {display ? <Badge variant="muted">{display}</Badge> : null}
                </Flex>
              </Tooltip>
            </SegmentedControl.Item>
          );
        })}
      </SegmentedControl>
    </Flex>
  );
}
