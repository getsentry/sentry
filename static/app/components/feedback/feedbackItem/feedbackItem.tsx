import {Fragment, ReactNode, useCallback} from 'react';
import styled from '@emotion/styled';

import AvatarList from 'sentry/components/avatar/avatarList';
import {Button} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import DateTime from 'sentry/components/dateTime';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import LazyLoad from 'sentry/components/lazyLoad';
import ObjectInspector from 'sentry/components/objectInspector';
import PanelItem from 'sentry/components/panels/panelItem';
import {Flex} from 'sentry/components/profiling/flex';
import ReplayIdCountProvider from 'sentry/components/replays/replayIdCountProvider';
import TextCopyInput from 'sentry/components/textCopyInput';
import {IconArchive, IconJson, IconLink, IconPlay, IconTag} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {AvatarUser} from 'sentry/types';
import type {HydratedFeedbackItem} from 'sentry/utils/feedback/types';
import {userDisplayName} from 'sentry/utils/formatters';
import useOrganization from 'sentry/utils/useOrganization';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

interface Props {
  feedbackItem: HydratedFeedbackItem;
}

export default function FeedbackItem({feedbackItem}: Props) {
  const organization = useOrganization();

  return (
    <FeedbackItemContainer>
      <HeaderPanelItem>
        <Flex gap={space(2)} justify="space-between">
          <Username feedbackItem={feedbackItem} />

          <Flex gap={space(1)} align="center">
            <ErrorBoundary mini>
              <Viewers feedbackItem={feedbackItem} />
            </ErrorBoundary>
            <ErrorBoundary mini>
              <ResolveButton feedbackItem={feedbackItem} />
            </ErrorBoundary>
          </Flex>
        </Flex>
      </HeaderPanelItem>
      <OverflowPanelItem>
        <Section title={t('Description')}>
          <Blockquote>
            <p>
              <pre>{feedbackItem.message}</pre>
            </p>
          </Blockquote>
        </Section>

        <Section icon={<IconLink size="xs" />} title={t('Url')}>
          <ErrorBoundary mini>
            <TextCopyInput size="sm">{feedbackItem.url}</TextCopyInput>
          </ErrorBoundary>
        </Section>

        {feedbackItem.replay_id ? (
          <ReplaySection organization={organization} replayId={feedbackItem.replay_id} />
        ) : null}

        <TagsSection tags={feedbackItem.tags} />

        <Section icon={<IconJson size="xs" />} title={t('Raw')}>
          <ObjectInspector
            data={feedbackItem}
            expandLevel={3}
            theme={{
              TREENODE_FONT_SIZE: '0.7rem',
              ARROW_FONT_SIZE: '0.5rem',
            }}
          />
        </Section>
      </OverflowPanelItem>
    </FeedbackItemContainer>
  );
}

const FeedbackItemContainer = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const HeaderPanelItem = styled(PanelItem)`
  display: grid;
  padding: ${space(1)} ${space(2)};
`;

const OverflowPanelItem = styled(PanelItem)`
  overflow: scroll;

  flex-direction: column;
  gap: ${space(3)};
`;

function Username({feedbackItem}: {feedbackItem: HydratedFeedbackItem}) {
  const displayValue = feedbackItem.user.display_name || feedbackItem.contact_email;
  const hasBoth = feedbackItem.user.display_name && feedbackItem.contact_email;
  if (!displayValue) {
    <strong>{t('Unknown User')}</strong>;
  }

  const Purple = styled('span')`
    color: ${p => p.theme.purple300};
  `;

  return (
    <Flex gap={space(1)} align="center">
      <strong>
        {hasBoth ? (
          <Fragment>
            {feedbackItem.user.display_name}
            <Purple>•</Purple>
            {feedbackItem.contact_email}
          </Fragment>
        ) : (
          displayValue
        )}
      </strong>
      {feedbackItem.contact_email ? (
        <CopyToClipboardButton
          size="xs"
          iconSize="xs"
          text={feedbackItem.contact_email}
        />
      ) : null}
    </Flex>
  );
}

function Viewers({feedbackItem: _}: {feedbackItem: HydratedFeedbackItem}) {
  const displayUsers = [
    {
      email: 'colton.allen@sentry.io',
      id: '1',
      ip_address: '',
      name: 'Colton Allen',
      username: 'cmanallen',
    },
  ];

  return (
    <AvatarList
      users={displayUsers}
      avatarSize={28}
      maxVisibleAvatars={13}
      renderTooltip={user => (
        <Fragment>
          {userDisplayName(user)}
          <br />
          <DateTime date={(user as AvatarUser).lastSeen} />
        </Fragment>
      )}
    />
  );
}

function ResolveButton({feedbackItem}: {feedbackItem: HydratedFeedbackItem}) {
  if (feedbackItem.status === 'unresolved') {
    return (
      <Button priority="primary" size="xs" icon={<IconArchive />}>
        {t('Resolve')}
      </Button>
    );
  }

  return (
    <Button size="xs" icon={<IconArchive />}>
      {t('Un-Resolve')}
    </Button>
  );
}

const SectionWrapper = styled('section')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
`;

const SectionTitle = styled('h3')`
  margin: 0;
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
  text-transform: capitalize;

  display: flex;
  gap: ${space(0.5)};
  align-items: center;
`;

function Section({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  title: string;
  icon?: ReactNode;
}) {
  return (
    <SectionWrapper>
      <SectionTitle>
        {icon}
        <span>{title}</span>
      </SectionTitle>
      {children}
    </SectionWrapper>
  );
}

function ReplaySection({organization, replayId}) {
  const replayPreview = useCallback(
    () => import('sentry/components/events/eventReplay/replayPreview'),
    []
  );

  return (
    <Section icon={<IconPlay size="xs" />} title={t('Linked Replay')}>
      <ErrorBoundary mini>
        <ReplayIdCountProvider organization={organization} replayIds={[replayId]}>
          <LazyLoad
            component={replayPreview}
            replaySlug={replayId}
            orgSlug={organization.slug}
            eventTimestampMs={0}
            buttonProps={{
              analyticsEventKey: 'issue_details.open_replay_details_clicked',
              analyticsEventName: 'Issue Details: Open Replay Details Clicked',
              analyticsParams: {
                organization,
              },
            }}
          />
        </ReplayIdCountProvider>
      </ErrorBoundary>
    </Section>
  );
}

function TagsSection({tags}) {
  const entries = Object.entries(tags);
  if (!entries.length) {
    return null;
  }

  return (
    <Section icon={<IconTag size="xs" />} t title={t('Tags')}>
      <ErrorBoundary mini>
        <KeyValueTable noMargin>
          {entries.map(([key, value]) => (
            <KeyValueTableRow key={key} keyName={key} value={value} />
          ))}
        </KeyValueTable>
      </ErrorBoundary>
    </Section>
  );
}

const Blockquote = styled('blockquote')`
  margin: 0 ${space(4)};
  position: relative;

  &::before {
    position: absolute;
    color: ${p => p.theme.purple300};
    content: '❝';
    font-size: ${space(4)};
    left: -${space(4)};
    top: -0.4rem;
  }
  &::after {
    position: absolute;
    border: 1px solid ${p => p.theme.purple300};
    bottom: 0;
    content: '';
    left: -${space(1)};
    top: 0;
  }

  & > p,
  & > p > pre {
    margin: 0;
  }
  & > p > pre {
    background: none;
    font-family: inherit;
    font-size: ${p => p.theme.fontSizeMedium};
    line-height: 1.6;
    padding: 0;
  }
`;
