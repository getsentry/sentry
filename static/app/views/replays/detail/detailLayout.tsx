import React from 'react';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import Button from 'sentry/components/button';
import Duration from 'sentry/components/duration';
import FeatureBadge from 'sentry/components/featureBadge';
import UserBadge from 'sentry/components/idBadge/userBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {KeyMetricData, KeyMetrics} from 'sentry/components/replays/keyMetrics';
import {useReplayContext} from 'sentry/components/replays/replayContext';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {RawCrumb} from 'sentry/types/breadcrumbs';
import {Event} from 'sentry/types/event';
import getUrlPathname from 'sentry/utils/getUrlPathname';

type Props = {
  children: React.ReactNode;
  orgId: string;
  crumbs?: RawCrumb[];
  event?: Event;
};

function DetailLayout({children, event, orgId, crumbs}: Props) {
  const title = event ? `${event.id} - Replays - ${orgId}` : `Replays - ${orgId}`;

  return (
    <SentryDocumentTitle title={title}>
      <React.Fragment>
        <Layout.Header>
          <HeaderContent>
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
            <ButtonWrapper>
              <Button
                title={t('Send us feedback via email')}
                href="mailto:replay-feedback@sentry.io?subject=Replay Details Feedback"
              >
                {t('Give Feedback')}
              </Button>
            </ButtonWrapper>
            <EventHeader event={event} />
            <EventMetaData event={event} crumbs={crumbs} />
          </HeaderContent>
        </Layout.Header>
        {children}
      </React.Fragment>
    </SentryDocumentTitle>
  );
}

function EventHeader({event}: Pick<Props, 'event'>) {
  if (!event) {
    return null;
  }

  const urlTag = event.tags.find(({key}) => key === 'url');
  const pathname = getUrlPathname(urlTag?.value ?? '') ?? '';

  return (
    <UserBadge
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

function EventMetaData({event, crumbs}: Pick<Props, 'event' | 'crumbs'>) {
  const {duration} = useReplayContext();

  if (!event) {
    return null;
  }

  const errors = crumbs?.filter(crumb => crumb.type === 'error').length;

  return (
    <KeyMetrics>
      <KeyMetricData
        keyName={t('Timestamp')}
        value={<TimeSince date={event.dateReceived} />}
      />
      <KeyMetricData
        keyName={t('Duration')}
        value={
          <Duration
            seconds={Math.floor(msToSec(duration || 0)) || 1}
            abbreviation
            exact
          />
        }
      />
      <KeyMetricData keyName={t('Errors')} value={errors} />
    </KeyMetrics>
  );
}

function msToSec(ms: number) {
  return ms / 1000;
}

const HeaderContent = styled(Layout.HeaderContent)`
  display: grid;
  grid-template-rows: auto auto;
  grid-template-columns: 2fr 1fr;
  gap: ${space(1)};
`;

const ButtonWrapper = styled('div')`
  text-align: right;
`;

export default DetailLayout;
