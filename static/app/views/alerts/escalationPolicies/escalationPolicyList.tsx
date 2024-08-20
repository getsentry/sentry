import {Fragment} from 'react';
import styled from '@emotion/styled';

import ParticipantList from 'sentry/components/group/streamlinedParticipantList';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import Timeline from 'sentry/components/timeline';
import {IconClock, IconExclamation, IconMegaphone, IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {User} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import AlertHeader from 'sentry/views/alerts/list/header';

function NotifyItem({users}: {users?: User[]}) {
  return (
    <Timeline.Item
      title={'Notify:'}
      icon={<IconMegaphone size="xs" />}
      colorConfig={{
        title: 'purple400',
        icon: 'purple400',
        iconBorder: 'purple200',
      }}
    >
      {users && <ParticipantList users={users} />}
    </Timeline.Item>
  );
}

function EscalateAfterItem({minutes}: {minutes: number}) {
  return (
    <EscalateAfterTimelineItem
      title={
        <Fragment>
          Escalate after{' '}
          <text style={{textDecoration: 'underline'}}>{minutes} minutes</text> if not
          acknowledged
        </Fragment>
      }
      icon={<IconClock size="xs" />}
      colorConfig={{
        title: 'blue400',
        icon: 'blue400',
        iconBorder: 'blue200',
      }}
      showLastLine
    />
  );
}

function IncidentCreatedItem() {
  return (
    <IncidentCreatedTimelineItem
      title={'Immediately after an incident is created...'}
      icon={<IconExclamation size="xs" />}
      colorConfig={{
        title: 'red400',
        icon: 'red400',
        iconBorder: 'red200',
      }}
      isActive
    />
  );
}

function RepeatItem() {
  return (
    <Timeline.Item
      title={'Repeat:'}
      icon={<IconRefresh size="xs" />}
      colorConfig={{
        title: 'purple400',
        icon: 'purple400',
        iconBorder: 'purple200',
      }}
    />
  );
}

function SideBarSection({children, title}: {children: React.ReactNode; title: string}) {
  return (
    <div>
      <SideBarTitle>{title}</SideBarTitle>
      {children}
    </div>
  );
}

interface EscalationPolicyTimelineProps {
  title?: string;
}

function EscalationPolicyTimeline({title}: EscalationPolicyTimelineProps) {
  return (
    <EscalationPolicyContainer>
      <h3>{title ?? 'Example Escalation Policy'}</h3>
      <EscalationPolicyContent>
        <Timeline.Container>
          <IncidentCreatedItem />
          <NotifyItem />
          <EscalateAfterItem minutes={10} />
          <NotifyItem />
          <EscalateAfterItem minutes={15} />
          <RepeatItem />
        </Timeline.Container>
        <SideBarContainer>
          <SideBarSection title={'Used by 1 service'}>Some content here</SideBarSection>
          <SideBarSection title={'Used by 2 teams'}>Some content here</SideBarSection>
          <SideBarSection title={'Send On-Call Handoff Notifications'}>
            when in use by a service
          </SideBarSection>
        </SideBarContainer>
      </EscalationPolicyContent>
    </EscalationPolicyContainer>
  );
}
function EscalationPolicyList() {
  const router = useRouter();
  const organization = useOrganization();

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Escalation Policies')} orgSlug={organization.slug} />

      <PageFiltersContainer>
        <AlertHeader router={router} activeTab="policies" />
        <Layout.Body>
          <Layout.Main fullWidth>
            <EscalationPolicyTimeline />
          </Layout.Main>
        </Layout.Body>
      </PageFiltersContainer>
    </Fragment>
  );
}

const IncidentCreatedTimelineItem = styled(Timeline.Item)`
  border-bottom: 1px solid transparent;
  &:not(:last-child) {
    border-image: linear-gradient(
        to right,
        transparent 20px,
        ${p => p.theme.translucentInnerBorder} 20px
      )
      100% 1;
  }
`;

const EscalateAfterTimelineItem = styled(Timeline.Item)`
  border-bottom: 1px solid transparent;
  &:not(:last-child) {
    border-image: linear-gradient(
        to right,
        transparent 20px,
        ${p => p.theme.translucentInnerBorder} 20px
      )
      100% 1;
  }
`;

const EscalationPolicyContainer = styled('div')`
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: 5px;
  padding: 15px;
  display: flex;
  flex-direction: column;
`;

const EscalationPolicyContent = styled('div')`
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 15px;
`;

const SideBarContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const SideBarTitle = styled('h6')`
  color: ${p => p.theme.subText};
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${space(1)} 0 0;
`;

export default EscalationPolicyList;
