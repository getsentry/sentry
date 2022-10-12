import {ReactNode} from 'react';
import styled from '@emotion/styled';

import {FeatureFeedback} from 'sentry/components/featureFeedback';
import * as Layout from 'sentry/components/layouts/thirds';
import DeleteButton from 'sentry/components/replays/deleteButton';
import DetailsPageBreadcrumbs from 'sentry/components/replays/header/detailsPageBreadcrumbs';
import {CrumbWalker} from 'sentry/components/replays/walker/urlWalker';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import space from 'sentry/styles/space';
import type {Crumb} from 'sentry/types/breadcrumbs';
import ChooseLayout from 'sentry/views/replays/detail/layout/chooseLayout';
import ReplayMetaData, {
  HeaderPlaceholder,
} from 'sentry/views/replays/detail/replayMetaData';
import type {ReplayRecord} from 'sentry/views/replays/types';

type Props = {
  children: ReactNode;
  orgSlug: string;
  crumbs?: Crumb[];
  replayRecord?: ReplayRecord;
};

function Page({children, crumbs, orgSlug, replayRecord}: Props) {
  const title = replayRecord
    ? `${replayRecord.id} - Replays - ${orgSlug}`
    : `Replays - ${orgSlug}`;

  const header = (
    <Header>
      <HeaderContent>
        <DetailsPageBreadcrumbs orgSlug={orgSlug} replayRecord={replayRecord} />
      </HeaderContent>
      <ButtonActionsWrapper>
        <DeleteButton />
        <ChooseLayout />
        <FeatureFeedback featureName="replay" buttonProps={{size: 'xs'}} />
      </ButtonActionsWrapper>

      {replayRecord && crumbs ? (
        <CrumbWalker replayRecord={replayRecord} crumbs={crumbs} />
      ) : (
        <HeaderPlaceholder />
      )}

      <MetaDataColumn>
        <ReplayMetaData replayRecord={replayRecord} />
      </MetaDataColumn>
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
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: ${space(2)} ${space(2)} ${space(1.5)} ${space(2)};
  }
`;

const HeaderContent = styled(Layout.HeaderContent)`
  margin-bottom: 0;
`;

// TODO(replay); This could make a lot of sense to put inside HeaderActions by default
const ButtonActionsWrapper = styled(Layout.HeaderActions)`
  display: grid;
  grid-template-columns: repeat(3, max-content);
  justify-content: flex-end;
  gap: ${space(1)};
`;

const MetaDataColumn = styled(Layout.HeaderActions)`
  padding-left: ${space(3)};
  align-self: end;
`;

const FullViewport = styled('div')`
  height: 100vh;
  width: 100%;

  display: grid;
  grid-template-rows: auto 1fr;
  overflow: hidden;

  /*
   * The footer component is a sibling of this div.
   * Remove it so the replay can take up the
   * entire screen.
   */
  ~ footer {
    display: none;
  }

  /*
  TODO: Set \`body { overflow: hidden; }\` so that the body doesn't wiggle
  when you try to scroll something that is non-scrollable.
  */
`;

export default Page;
