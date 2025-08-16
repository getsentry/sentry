import {Fragment} from 'react';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import Pagination from 'sentry/components/pagination';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import type {TeamActor} from 'sentry/components/teamSelector';
import {Timeline} from 'sentry/components/timeline';
import {IconClock, IconExclamation, IconMegaphone, IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {User} from 'sentry/types/user';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import AlertHeader from 'sentry/views/alerts/list/header';
import {
  type EscalationPolicy,
  type EscalationPolicyStepRecipient,
  useFetchEscalationPolicies,
} from 'sentry/views/escalationPolicies/queries/useFetchEscalationPolicies';
import type {RotationSchedule} from 'sentry/views/escalationPolicies/queries/useFetchRotationSchedules';
import ParticipantList from 'sentry/views/issueDetails/streamline/sidebar/participantList';

function NotifyItem({recipients}: {recipients: EscalationPolicyStepRecipient[]}) {
  const users: User[] =
    recipients
      .filter(r => {
        return r.type === 'user';
      })
      .map(r => r.data as User) || [];
  const teams: TeamActor[] =
    recipients
      .filter(r => {
        return r.type === 'team';
      })
      .map(r => r.data as TeamActor) || [];
  const schedules: RotationSchedule[] =
    recipients
      .filter(r => {
        return r.type === 'schedule';
      })
      .map(r => r.data as RotationSchedule) || [];
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
      <ParticipantList
        users={users}
        teams={teams}
        schedules={schedules}
        maxVisibleAvatars={10}
      />
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

function RepeatItem({n}: {n: number}) {
  return (
    <Timeline.Item
      title={'Repeat: ' + n + ' time' + (n > 1 ? 's' : '')}
      icon={<IconRefresh size="xs" />}
      colorConfig={{
        title: 'yellow400',
        icon: 'yellow400',
        iconBorder: 'yellow200',
      }}
      isActive
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

function EscalationPolicyTimeline({policy}: {policy: EscalationPolicy}) {
  return (
    <EscalationPolicyContainer>
      <h3>{policy.name}</h3>
      <EscalationPolicyContent>
        <Timeline.Container>
          <IncidentCreatedItem />
          {policy.steps.map(policyStep => {
            return (
              <div key={policyStep.stepNumber}>
                <NotifyItem recipients={policyStep.recipients} />
                <EscalateAfterItem
                  minutes={Math.ceil(policyStep.escalateAfterSec / 60)}
                />
              </div>
            );
          })}
          <RepeatItem n={policy.repeatNTimes} />
        </Timeline.Container>
        <RightSideBarContainer>
          <SideBarSection title={'Used by 1 Alert'}>Some content here</SideBarSection>
        </RightSideBarContainer>
      </EscalationPolicyContent>
    </EscalationPolicyContainer>
  );
}
function EscalationPolicyList() {
  const router = useRouter();
  const organization = useOrganization();
  const location = useLocation();

  const {
    data: escalationPolicies = [],
    // refetch,
    getResponseHeader,
    // isLoading,
    // isError,
  } = useFetchEscalationPolicies({orgSlug: organization.slug}, {});
  const escalationPoliciesPageLinks = getResponseHeader?.('Link');
  const {cursor: _cursor, page: _page, ...currentQuery} = location.query;

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Escalation Policies')} orgSlug={organization.slug} />

      <PageFiltersContainer>
        <AlertHeader activeTab="policies" />
        <Layout.Body>
          <Layout.Main fullWidth>
            <EscalationPolicyTimelineList>
              {escalationPolicies.map((escalationPolicy: EscalationPolicy) => (
                <EscalationPolicyTimeline
                  key={escalationPolicy.id}
                  policy={escalationPolicy}
                />
              ))}
            </EscalationPolicyTimelineList>
          </Layout.Main>
        </Layout.Body>
        <Pagination
          pageLinks={escalationPoliciesPageLinks}
          onCursor={(cursor, path, _direction) => {
            router.push({
              pathname: path,
              query: {...currentQuery, cursor},
            });
          }}
        />
      </PageFiltersContainer>
    </Fragment>
  );
}

const EscalationPolicyTimelineList = styled('ul')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  padding: 0;
`;

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

const EscalationPolicyContainer = styled('li')`
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: 5px;
  padding: 15px;
  display: flex;
  flex-direction: column;
`;

const EscalationPolicyContent = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const RightSideBarContainer = styled('div')`
  display: flex;
  flex-direction: column;
  width: 500px;
`;

const SideBarTitle = styled('h6')`
  color: ${p => p.theme.subText};
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSize.md};
  margin: ${space(1)} 0 0;
`;

export default EscalationPolicyList;
