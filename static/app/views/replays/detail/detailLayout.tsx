import React from 'react';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import Duration from 'sentry/components/duration';
import FeatureBadge from 'sentry/components/featureBadge';
import {FeatureFeedback} from 'sentry/components/featureFeedback';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import Placeholder from 'sentry/components/placeholder';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import TimeSince from 'sentry/components/timeSince';
import {PlatformKey} from 'sentry/data/platformCategories';
import {IconCalendar, IconClock, IconFire} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Crumb} from 'sentry/types/breadcrumbs';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import getUrlPathname from 'sentry/utils/getUrlPathname';

type Props = {
  children: React.ReactNode;
  orgId: string;
};

function DetailLayout({children, orgId}: Props) {
  const {replay} = useReplayContext();

  const event = replay?.getEvent();
  const crumbs = replay?.getRawCrumbs();

  const documentTitle = event ? `${event.id} - Replays - ${orgId}` : `Replays - ${orgId}`;
  const labelTitle =
    event?.user?.name ||
    event?.user?.email ||
    event?.user?.username ||
    event?.user?.ip_address ||
    event?.user?.id;

  const urlTag = event?.tags?.find(({key}) => key === 'url');
  const pathname = getUrlPathname(urlTag?.value ?? '') ?? '';

  return (
    <SentryDocumentTitle title={documentTitle}>
      <React.Fragment>
        <Header>
          <HeaderContent>
            <Breadcrumbs
              crumbs={[
                {
                  to: `/organizations/${orgId}/replays/`,
                  label: t('Replays'),
                },
                {
                  label: labelTitle ? (
                    <React.Fragment>
                      {labelTitle} <FeatureBadge type="alpha" />
                    </React.Fragment>
                  ) : (
                    <HeaderPlaceholder width="500px" height="24px" />
                  ),
                },
              ]}
            />
          </HeaderContent>
          <ButtonActionsWrapper>
            <FeatureFeedback featureName="replay" buttonProps={{size: 'sm'}} />
          </ButtonActionsWrapper>
          <SubHeading>{pathname}</SubHeading>
          <MetaDataColumn>
            <EventMetaData event={event} crumbs={crumbs} />
          </MetaDataColumn>
        </Header>
        {children}
      </React.Fragment>
    </SentryDocumentTitle>
  );
}

const Header = styled(Layout.Header)`
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding-bottom: ${space(1.5)};
  }
`;

const HeaderPlaceholder = styled(function HeaderPlaceholder(
  props: React.ComponentProps<typeof Placeholder>
) {
  return <Placeholder width="100%" height="19px" {...props} />;
})`
  background-color: ${p => p.theme.background};
`;

const HeaderContent = styled(Layout.HeaderContent)`
  margin-bottom: 0;
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

function EventMetaData({
  event,
  crumbs,
}: {
  crumbs: Crumb[] | undefined;
  event: Event | undefined;
}) {
  const {duration} = useReplayContext();

  const errors = crumbs?.filter(crumb => crumb.type === 'error').length;

  return (
    <KeyMetrics>
      <ProjectBadge
        project={{
          slug: event?.projectSlug || '',
          id: event?.projectID,
          platform: event?.platform as PlatformKey,
        }}
        avatarSize={16}
      />
      <KeyMetricData>
        {event ? (
          <React.Fragment>
            <IconCalendar color="gray300" />
            <TimeSince date={event.dateReceived} shorten />
          </React.Fragment>
        ) : (
          <HeaderPlaceholder />
        )}
      </KeyMetricData>
      <KeyMetricData>
        {duration !== undefined ? (
          <React.Fragment>
            <IconClock color="gray300" />
            <Duration
              seconds={Math.floor(msToSec(duration || 0)) || 1}
              abbreviation
              exact
            />
          </React.Fragment>
        ) : (
          <HeaderPlaceholder />
        )}
      </KeyMetricData>
      <KeyMetricData>
        {defined(errors) ? (
          <React.Fragment>
            <IconFire color="red300" />
            {errors}
          </React.Fragment>
        ) : (
          <HeaderPlaceholder />
        )}
      </KeyMetricData>
    </KeyMetrics>
  );
}

const KeyMetrics = styled('div')`
  display: grid;
  gap: ${space(3)};
  grid-template-columns: repeat(4, max-content);
  align-items: center;
  justify-content: end;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const KeyMetricData = styled('div')`
  color: ${p => p.theme.textColor};
  font-weight: normal;
  display: grid;
  grid-template-columns: repeat(2, max-content);
  align-items: center;
  gap: ${space(1)};
`;

function msToSec(ms: number) {
  return ms / 1000;
}

// TODO(replay); This could make a lot of sense to put inside HeaderActions by default
const ButtonActionsWrapper = styled(Layout.HeaderActions)`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  justify-content: flex-end;
`;

export default DetailLayout;
