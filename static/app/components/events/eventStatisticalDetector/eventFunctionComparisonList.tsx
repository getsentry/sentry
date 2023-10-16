import {Fragment, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {EventDataSection} from 'sentry/components/events/eventDataSection';
import Link from 'sentry/components/links/link';
import PerformanceDuration from 'sentry/components/performanceDuration';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Event, Group, Organization, Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';
import {getShortEventId} from 'sentry/utils/events';
import {useProfileEvents} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {useProfileFunctions} from 'sentry/utils/profiling/hooks/useProfileFunctions';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';

interface EventFunctionComparisonListProps {
  event: Event;
  group: Group;
  project: Project;
}

export function EventFunctionComparisonList({
  event,
  project,
}: EventFunctionComparisonListProps) {
  const evidenceData = event.occurrence?.evidenceData;
  const fingerprint = evidenceData?.fingerprint;
  const breakpoint = evidenceData?.breakpoint;
  const frameName = evidenceData?.function;
  const framePackage = evidenceData?.package || evidenceData?.module;

  const isValid =
    defined(fingerprint) &&
    defined(breakpoint) &&
    defined(frameName) &&
    defined(framePackage);

  useEffect(() => {
    if (isValid) {
      return;
    }

    Sentry.withScope(scope => {
      scope.setContext('evidence data fields', {
        fingerprint,
        breakpoint,
        frameName,
        framePackage,
      });

      Sentry.captureException(
        new Error('Missing required evidence data on function regression issue.')
      );
    });
  }, [isValid, fingerprint, breakpoint, frameName, framePackage]);

  if (!isValid) {
    return null;
  }

  return (
    <EventComparisonListInner
      breakpoint={breakpoint}
      fingerprint={fingerprint}
      frameName={frameName}
      framePackage={framePackage}
      project={project}
    />
  );
}

interface EventComparisonListInnerProps {
  breakpoint: number;
  fingerprint: number;
  frameName: string;
  framePackage: string;
  project: Project;
}

function EventComparisonListInner({
  breakpoint,
  fingerprint,
  frameName,
  framePackage,
  project,
}: EventComparisonListInnerProps) {
  const organization = useOrganization();

  const breakpointDateTime = new Date(breakpoint * 1000);
  const datetime = useRelativeDateTime({
    anchor: breakpoint,
    relativeDays: 1,
  });
  const {start: beforeDateTime, end: afterDateTime} = datetime;

  const beforeProfilesQuery = useProfileFunctions({
    datetime: {
      start: beforeDateTime,
      end: breakpointDateTime,
      utc: true,
      period: null,
    },
    fields: ['examples()'],
    sort: {
      key: 'examples()',
      order: 'asc',
    },
    query: `fingerprint:${fingerprint}`,
    projects: [project.id],
    limit: 1,
    referrer: 'api.profiling.functions.regression.list',
  });

  const afterProfilesQuery = useProfileFunctions({
    datetime: {
      start: breakpointDateTime,
      end: afterDateTime,
      utc: true,
      period: null,
    },
    fields: ['examples()'],
    sort: {
      key: 'examples()',
      order: 'asc',
    },
    query: `fingerprint:${fingerprint}`,
    projects: [project.id],
    limit: 1,
    referrer: 'api.profiling.functions.regression.list',
  });

  const beforeProfileIds =
    (beforeProfilesQuery.data?.data?.[0]?.['examples()'] as string[]) ?? [];
  const afterProfileIds =
    (afterProfilesQuery.data?.data?.[0]?.['examples()'] as string[]) ?? [];

  const profilesQuery = useProfileEvents({
    datetime,
    fields: ['id', 'transaction', 'profile.duration'],
    query: `id:[${[...beforeProfileIds, ...afterProfileIds].join(', ')}]`,
    sort: {
      key: 'profile.duration',
      order: 'desc',
    },
    projects: [project.id],
    limit: beforeProfileIds.length + afterProfileIds.length,
    enabled: beforeProfileIds.length > 0 && afterProfileIds.length > 0,
    referrer: 'api.profiling.functions.regression.examples',
  });

  const beforeProfiles = useMemo(() => {
    const profileIds = new Set(
      (beforeProfilesQuery.data?.data?.[0]?.['examples()'] as string[]) ?? []
    );

    return (
      (profilesQuery.data?.data?.filter(row =>
        profileIds.has(row.id as string)
      ) as ProfileItem[]) ?? []
    );
  }, [beforeProfilesQuery, profilesQuery]);

  const afterProfiles = useMemo(() => {
    const profileIds = new Set(
      (afterProfilesQuery.data?.data?.[0]?.['examples()'] as string[]) ?? []
    );

    return (
      (profilesQuery.data?.data?.filter(row =>
        profileIds.has(row.id as string)
      ) as ProfileItem[]) ?? []
    );
  }, [afterProfilesQuery, profilesQuery]);

  return (
    <Wrapper>
      <EventDataSection type="profiles-before" title={t('Example Profiles Before')}>
        <EventList
          frameName={frameName}
          framePackage={framePackage}
          organization={organization}
          profiles={beforeProfiles}
          project={project}
        />
      </EventDataSection>
      <EventDataSection type="profiles-after" title={t('Example Profiles After')}>
        <EventList
          frameName={frameName}
          framePackage={framePackage}
          organization={organization}
          profiles={afterProfiles}
          project={project}
        />
      </EventDataSection>
    </Wrapper>
  );
}

interface ProfileItem {
  id: string;
  'profile.duration': number;
  timestamp: string;
  transaction: string;
}

interface EventListProps {
  frameName: string;
  framePackage: string;
  organization: Organization;
  profiles: ProfileItem[];
  project: Project;
}

function EventList({
  frameName,
  framePackage,
  organization,
  profiles,
  project,
}: EventListProps) {
  return (
    <ListContainer>
      <Container>
        <strong>{t('Profile ID')}</strong>
      </Container>
      <Container>
        <strong>{t('Transaction')}</strong>
      </Container>
      <NumberContainer>
        <strong>{t('Duration')} </strong>
        <QuestionTooltip size="xs" position="top" title={t('The profile duration')} />
      </NumberContainer>
      {profiles.map(item => {
        const target = generateProfileFlamechartRouteWithQuery({
          orgSlug: organization.slug,
          projectSlug: project.slug,
          profileId: item.id,
          query: {
            frameName,
            framePackage,
          },
        });

        return (
          <Fragment key={item.id}>
            <Container>
              <Link
                to={target}
                onClick={() => {
                  trackAnalytics('profiling_views.go_to_flamegraph', {
                    organization,
                    source: 'profiling.issue.function_regression.list',
                  });
                }}
              >
                {getShortEventId(item.id)}
              </Link>
            </Container>
            <Container>{item.transaction}</Container>
            <NumberContainer>
              <PerformanceDuration nanoseconds={item['profile.duration']} abbreviation />
            </NumberContainer>
          </Fragment>
        );
      })}
    </ListContainer>
  );
}

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 1fr 1fr;
  }
`;

const ListContainer = styled('div')`
  display: grid;
  grid-template-columns: minmax(75px, 1fr) auto minmax(75px, 1fr);
  gap: ${space(1)};
`;
