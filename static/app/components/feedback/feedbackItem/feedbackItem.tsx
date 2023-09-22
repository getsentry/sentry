import {Fragment} from 'react';
import styled from '@emotion/styled';

import AvatarList from 'sentry/components/avatar/avatarList';
import {Button} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import DateTime from 'sentry/components/dateTime';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import PanelItem from 'sentry/components/panels/panelItem';
import {Flex} from 'sentry/components/profiling/flex';
import TextCopyInput from 'sentry/components/textCopyInput';
import {IconArchive} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {AvatarUser} from 'sentry/types';
import type {HydratedFeedbackItem} from 'sentry/utils/feedback/types';
import {userDisplayName} from 'sentry/utils/formatters';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

interface Props {
  feedbackItem: HydratedFeedbackItem;
}

export default function FeedbackItem({feedbackItem}: Props) {
  return (
    <FeedbackItemContainer>
      <HeaderPanelItem>
        <Flex gap={space(2)} justify="space-between">
          <Username feedbackItem={feedbackItem} />
          <Flex gap={space(1)} align="center">
            <Viewers feedbackItem={feedbackItem} />
            <ResolveButton feedbackItem={feedbackItem} />
          </Flex>
        </Flex>
      </HeaderPanelItem>
      <OverflowPanelItem>
        <Section title={t('Description')}>
          <Blockquote>
            <p>{feedbackItem.message}</p>
          </Blockquote>
        </Section>

        <Section title={t('Url')}>
          <TextCopyInput size="sm">{feedbackItem.url}</TextCopyInput>
        </Section>

        <Section title={t('Tags')}>
          <KeyValueTable noMargin>
            {Object.entries(feedbackItem.tags).map(([key, value]) => (
              <KeyValueTableRow key={key} keyName={key} value={value} />
            ))}
          </KeyValueTable>
        </Section>

        <Section title={t('Raw')}>
          <pre>{JSON.stringify(feedbackItem, null, '\t')}</pre>
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
  flex-direction: column;
  overflow: scroll;
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

function Section({children, title}: {children; title: string}) {
  return (
    <section style={{marginInline: space(1)}}>
      <SectionTitle>{title}</SectionTitle>
      {children}
    </section>
  );
}

const SectionTitle = styled('h3')`
  margin-top: ${space(3)};
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
  text-transform: capitalize;
`;

const Blockquote = styled('blockquote')`
  margin-left: ${space(1.5)};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  position: relative;

  quotes: '❝' '❞' '‘' '’';
  &::before,
  &::after {
    position: absolute;
    color: ${p => p.theme.purple400};
    font-size: ${p => p.theme.fontSizeExtraLarge};
  }
  &::before {
    content: open-quote;
    top: -0.2rem;
    left: -0.8rem;
  }
  &::after {
    content: close-quote;
    bottom: 0;
    right: -0.4rem;
  }
`;
