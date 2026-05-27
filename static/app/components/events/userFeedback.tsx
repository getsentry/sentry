import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {ActivityAvatar} from 'sentry/components/activity/item/avatar';
import {TimeSince} from 'sentry/components/timeSince';
import {IconCopy} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {UserReport} from 'sentry/types/group';
import type {AvatarUser} from 'sentry/types/user';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';

type Props = {
  report: UserReport;
  eventLink?: string;
};

export function EventUserFeedback({eventLink, report}: Props) {
  const {copy} = useCopyToClipboard();
  const showEmailLabel = !isSameIdentity(report.name, report.email);
  const copyEmail = () =>
    copy(report.email, {successMessage: t('Copied email to clipboard')});

  return (
    <Flex data-test-id="activity-item" gap="md">
      <ActivityAvatar type="user" user={getAvatarUser(report)} />

      <FeedbackBubble>
        <Flex align="center" padding="sm xl" borderBottom="primary">
          <Flex flex={1} align="center" gap="md">
            <Text as="span" bold size="md">
              {report.name}
            </Text>
            {showEmailLabel ? (
              <Button
                variant="transparent"
                onClick={copyEmail}
                size="zero"
                tooltipProps={{delay: 0, title: t('Copy email address')}}
                icon={<IconCopy size="xs" variant="muted" />}
              >
                <Text as="span" size="sm" variant="muted">
                  {report.email}
                </Text>
              </Button>
            ) : (
              <Button
                aria-label={t('Copy email address')}
                variant="transparent"
                onClick={copyEmail}
                size="zero"
                tooltipProps={{delay: 0, title: t('Copy email address')}}
                icon={<IconCopy size="xs" variant="muted" />}
              />
            )}

            {eventLink && (
              <Text as="span" size="sm">
                <Link to={eventLink}>{t('View event')}</Link>
              </Text>
            )}
          </Flex>

          <Text as="span" variant="muted">
            <TimeSince date={report.dateCreated} />
          </Text>
        </Flex>

        <Container padding="xl">
          <Text as="p" density="comfortable" wrap="pre-line">
            {report.comments}
          </Text>
        </Container>
      </FeedbackBubble>
    </Flex>
  );
}

function isSameIdentity(name: string, email: string) {
  return name.trim().toLowerCase() === email.trim().toLowerCase();
}

function getAvatarUser(report: UserReport): AvatarUser | undefined {
  const user = report.user;

  if (!user) {
    return undefined;
  }

  return {
    id: user.id,
    email: user.email ?? '',
    name: user.name ?? report.name,
    username: user.username ?? '',
    ip_address: user.ipAddress ?? '',
    avatarUrl: user.avatarUrl ?? undefined,
  };
}

const FeedbackBubble = styled('div')`
  display: flex;
  justify-content: center;
  flex-direction: column;
  align-items: stretch;
  flex: 1;
  width: 75%;
  overflow-wrap: break-word;
  background-color: ${p => p.theme.tokens.background.primary};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  position: relative;

  &:before {
    display: block;
    content: '';
    width: 0;
    height: 0;
    border-top: 7px solid transparent;
    border-bottom: 7px solid transparent;
    border-right: 7px solid ${p => p.theme.tokens.border.primary};
    position: absolute;
    left: -7px;
    top: 12px;
  }

  &:after {
    display: block;
    content: '';
    width: 0;
    height: 0;
    border-top: 6px solid transparent;
    border-bottom: 6px solid transparent;
    /* eslint-disable-next-line @sentry/scraps/use-semantic-token */
    border-right: 6px solid ${p => p.theme.tokens.background.primary};
    position: absolute;
    left: -6px;
    top: 13px;
  }
`;
