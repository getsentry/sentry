import {ReactNode} from 'react';
import styled from '@emotion/styled';

import {FeatureFeedback} from 'sentry/components/featureFeedback';
import * as Layout from 'sentry/components/layouts/thirds';
import DetailsPageBreadcrumbs from 'sentry/components/replays/header/detailsPageBreadcrumbs';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import space from 'sentry/styles/space';
import type {Crumb} from 'sentry/types/breadcrumbs';
import type {EventTransaction} from 'sentry/types/event';
import getUrlPathname from 'sentry/utils/getUrlPathname';
import EventMetaData, {
  HeaderPlaceholder,
} from 'sentry/views/replays/detail/eventMetaData';
import ChooseLayout from 'sentry/views/replays/detail/layout/chooseLayout';

type Props = {
  children: ReactNode;
  orgId: string;
  crumbs?: Crumb[];
  durationMS?: number;
  event?: EventTransaction;
};

function Page({children, crumbs, durationMS, event, orgId}: Props) {
  const title = event ? `${event.id} - Replays - ${orgId}` : `Replays - ${orgId}`;

  const urlTag = event?.tags?.find(({key}) => key === 'url');
  const pathname = getUrlPathname(urlTag?.value ?? '') ?? '';

  const header = (
    <Header>
      <HeaderContent>
        <DetailsPageBreadcrumbs orgId={orgId} event={event} />
      </HeaderContent>
      <ButtonActionsWrapper>
        <FeatureFeedback featureName="replay" buttonProps={{size: 'xs'}} />
        <ChooseLayout />
      </ButtonActionsWrapper>
      <SubHeading>{pathname || <HeaderPlaceholder />}</SubHeading>
      <MetaDataColumn>
        <EventMetaData crumbs={crumbs} durationMS={durationMS} event={event} />
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
  grid-template-columns: repeat(2, max-content);
  justify-content: flex-end;
  gap: ${space(1)};
`;

const SubHeading = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.subText};
  align-self: end;
  ${p => p.theme.overflowEllipsis};
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
