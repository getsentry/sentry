import {Badge} from 'sentry/components/core/badge';
import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import {Tooltip} from 'sentry/components/core/tooltip';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import useMailboxCounts from 'sentry/components/feedback/list/useMailboxCounts';
import type {Mailbox} from 'sentry/components/feedback/useMailbox';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  onChange: (next: Mailbox) => void;
  value: Mailbox;
}

export default function MailboxPicker({onChange, value}: Props) {
  const organization = useOrganization();
  const {data} = useMailboxCounts({organization});
  const {isSelfHosted} = useLegacyStore(ConfigStore);

  const {areAiFeaturesAllowed, setupAcknowledgement} = useOrganizationSeerSetup();
  const hasSpamFeature = organization.features.includes('user-feedback-spam-ingest');
  const skipConsentFlow = organization.features.includes('gen-ai-consent-flow-removal');

  const getSpamTooltip = () => {
    if (!hasSpamFeature || isSelfHosted) {
      return undefined;
    }

    if (!skipConsentFlow && !setupAcknowledgement.orgHasAcknowledged) {
      return tct(
        'Generative AI Features and Seer access are required for auto spam detection. Check that [linkGenAI:Generative AI Features] are toggled on, then view the [linkSeer:Seer settings page] for more information.',
        {
          linkSeer: <Link to={`/settings/${organization.slug}/seer/`} />,
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

    return undefined;
  };

  const MAILBOXES = [
    {key: 'unresolved', label: t('Inbox')},
    {key: 'resolved', label: t('Resolved')},
    {
      key: 'ignored',
      label: t('Spam'),
      tooltip: getSpamTooltip(),
    },
  ];

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
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          const count = data?.[mailbox.key];
          const display = count && count >= 100 ? '99+' : count;
          const title =
            count === 1 ? t('1 unassigned item') : t('%s unassigned items', display);
          return (
            <SegmentedControl.Item key={mailbox.key} aria-label={mailbox.label}>
              <Tooltip disabled={!count} title={title}>
                <Flex align="center" gap="sm">
                  {mailbox.tooltip ? (
                    <Tooltip isHoverable title={mailbox.tooltip}>
                      {mailbox.label}
                    </Tooltip>
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
