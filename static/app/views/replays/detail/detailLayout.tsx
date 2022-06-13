import React, {useMemo} from 'react';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import Button from 'sentry/components/button';
import Clipboard from 'sentry/components/clipboard';
import Duration from 'sentry/components/duration';
import FeatureBadge from 'sentry/components/featureBadge';
import {FeatureFeedback} from 'sentry/components/featureFeedback';
import UserBadge, {StyledName} from 'sentry/components/idBadge/userBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import Placeholder from 'sentry/components/placeholder';
import {KeyMetricData, KeyMetrics} from 'sentry/components/replays/keyMetrics';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import TimeSince from 'sentry/components/timeSince';
import {IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Crumb} from 'sentry/types/breadcrumbs';
import {Event} from 'sentry/types/event';
import getUrlPathname from 'sentry/utils/getUrlPathname';
import createUrlToShare from 'sentry/utils/replays/createUrlToShare';

type Props = {
  children: React.ReactNode;
  orgId: string;
  crumbs?: Crumb[];
  event?: Event;
};

function DetailLayout({children, event, orgId, crumbs}: Props) {
  const {currentTime} = useReplayContext();
  const title = event ? `${event.id} - Replays - ${orgId}` : `Replays - ${orgId}`;

  const urlToShare = useMemo(() => {
    return createUrlToShare(currentTime);
  }, [currentTime]);

  return (
    <SentryDocumentTitle title={title}>
      <React.Fragment>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {
                  to: `/organizations/${orgId}/replays/`,
                  label: t('Replays'),
                },
                {
                  label: (
                    <React.Fragment>
                      {t('Replay Details')}
                      <FeatureBadge type="alpha" />
                    </React.Fragment>
                  ),
                },
              ]}
            />
          </Layout.HeaderContent>
          <ButtonActionsWrapper>
            <Clipboard hideUnsupported value={urlToShare}>
              <Button icon={<IconLink />}>{t('Share')}</Button>
            </Clipboard>
            <FeatureFeedback
              featureName="replay"
              feedbackTypes={[
                t('Something is broken'),
                t("I don't understand how to use this feature"),
                t('I like this feature'),
                t('Other reason'),
              ]}
            />
          </ButtonActionsWrapper>
          <React.Fragment>
            <Layout.HeaderContent>
              <EventHeader event={event} />
            </Layout.HeaderContent>
            <MetaDataColumn>
              <EventMetaData event={event} crumbs={crumbs} />
            </MetaDataColumn>
          </React.Fragment>
        </Layout.Header>
        {children}
      </React.Fragment>
    </SentryDocumentTitle>
  );
}

const HeaderPlaceholder = styled(function HeaderPlaceholder(
  props: React.ComponentProps<typeof Placeholder>
) {
  return <Placeholder width="100%" height="19px" {...props} />;
})`
  background-color: ${p => p.theme.background};
`;

function EventHeader({event}: Pick<Props, 'event'>) {
  if (!event) {
    return <HeaderPlaceholder width="500px" height="48px" />;
  }

  const urlTag = event.tags.find(({key}) => key === 'url');
  const pathname = getUrlPathname(urlTag?.value ?? '') ?? '';

  return (
    <BigNameUserBadge
      avatarSize={32}
      user={{
        username: event.user?.username ?? '',
        id: event.user?.id ?? '',
        ip_address: event.user?.ip_address ?? '',
        name: event.user?.name ?? '',
        email: event.user?.email ?? '',
      }}
      // this is the subheading for the avatar, so displayEmail in this case is a misnomer
      displayEmail={pathname}
    />
  );
}

const MetaDataColumn = styled(Layout.HeaderActions)`
  width: 325px;
`;

function EventMetaData({event, crumbs}: Pick<Props, 'event' | 'crumbs'>) {
  const {duration} = useReplayContext();

  const errors = crumbs?.filter(crumb => crumb.type === 'error').length;

  return (
    <KeyMetrics>
      <KeyMetricData
        keyName={t('Timestamp')}
        value={event ? <TimeSince date={event.dateReceived} /> : <HeaderPlaceholder />}
      />
      <KeyMetricData
        keyName={t('Duration')}
        value={
          duration !== undefined ? (
            <Duration
              seconds={Math.floor(msToSec(duration || 0)) || 1}
              abbreviation
              exact
            />
          ) : (
            <HeaderPlaceholder />
          )
        }
      />
      <KeyMetricData keyName={t('Errors')} value={errors ?? <HeaderPlaceholder />} />
    </KeyMetrics>
  );
}

function msToSec(ms: number) {
  return ms / 1000;
}

const BigNameUserBadge = styled(UserBadge)`
  align-items: flex-start;

  ${StyledName} {
    font-size: 26px;
  }
`;

// TODO(replay); This could make a lot of sense to put inside HeaderActions by default
const ButtonActionsWrapper = styled(Layout.HeaderActions)`
  display: grid;
  grid-template-columns: repeat(2, max-content);
  justify-content: flex-end;
  gap: ${space(1)};
`;

export default DetailLayout;
