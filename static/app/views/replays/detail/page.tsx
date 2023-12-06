import {ReactNode} from 'react';
import styled from '@emotion/styled';

import UserBadge from 'sentry/components/idBadge/userBadge';
import FullViewport from 'sentry/components/layouts/fullViewport';
import * as Layout from 'sentry/components/layouts/thirds';
import DeleteButton from 'sentry/components/replays/header/deleteButton';
import DetailsPageBreadcrumbs from 'sentry/components/replays/header/detailsPageBreadcrumbs';
import FeedbackButton from 'sentry/components/replays/header/feedbackButton';
import HeaderPlaceholder from 'sentry/components/replays/header/headerPlaceholder';
import ReplayMetaData from 'sentry/components/replays/header/replayMetaData';
import ShareButton from 'sentry/components/replays/shareButton';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ReplayError, ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  children: ReactNode;
  orgSlug: string;
  projectSlug: string | null;
  replayErrors: ReplayError[];
  replayRecord: undefined | ReplayRecord;
};

function Page({children, orgSlug, replayRecord, projectSlug, replayErrors}: Props) {
  const title = replayRecord
    ? `${replayRecord.id} — Session Replay — ${orgSlug}`
    : `Session Replay — ${orgSlug}`;

  const header = replayRecord?.is_archived ? (
    <Header>
      <DetailsPageBreadcrumbs orgSlug={orgSlug} replayRecord={replayRecord} />
    </Header>
  ) : (
    <Header>
      <DetailsPageBreadcrumbs orgSlug={orgSlug} replayRecord={replayRecord} />

      <ButtonActionsWrapper>
        <ShareButton />
        <FeedbackButton />
        {replayRecord?.id && projectSlug && (
          <DeleteButton replayId={replayRecord.id} projectSlug={projectSlug} />
        )}
      </ButtonActionsWrapper>

      {replayRecord ? (
        <UserBadge
          avatarSize={32}
          displayName={
            <Layout.Title>
              {replayRecord.user.display_name || t('Anonymous User')}
            </Layout.Title>
          }
          user={{
            name: replayRecord.user.display_name || '',
            email: replayRecord.user.email || '',
            username: replayRecord.user.username || '',
            ip_address: replayRecord.user.ip || '',
            id: replayRecord.user.id || '',
          }}
          hideEmail
        />
      ) : (
        <HeaderPlaceholder width="100%" height="58px" />
      )}

      <ReplayMetaData replayRecord={replayRecord} replayErrors={replayErrors} />
    </Header>
  );

  return (
    <SentryDocumentTitle title={title}>
      <FullViewport>
        {header}
        {children}
      </FullViewport>
    </SentryDocumentTitle>
  );
}

const Header = styled(Layout.Header)`
  gap: ${space(1)};
  padding-bottom: ${space(1.5)};
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    gap: ${space(1)} ${space(3)};
    padding: ${space(2)} ${space(2)} ${space(1.5)} ${space(2)};
  }
`;

// TODO(replay); This could make a lot of sense to put inside HeaderActions by default
const ButtonActionsWrapper = styled(Layout.HeaderActions)`
  flex-direction: row;
  justify-content: flex-end;
  gap: ${space(1)};
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    margin-bottom: 0;
  }
`;

export default Page;
