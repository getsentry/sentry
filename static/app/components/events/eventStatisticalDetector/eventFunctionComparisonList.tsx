import {Fragment, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import Link from 'sentry/components/links/link';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {Container, NumberContainer} from 'sentry/utils/discover/styles';
import {getShortEventId} from 'sentry/utils/events';
import {useProfileEvents} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {useProfileFunctions} from 'sentry/utils/profiling/hooks/useProfileFunctions';
import {useRelativeDateTime} from 'sentry/utils/profiling/hooks/useRelativeDateTime';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

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
    fields: ['profile.id', 'transaction', 'transaction.duration'],
    query: `profile.id:[${[...beforeProfileIds, ...afterProfileIds].join(', ')}]`,
    sort: {
      key: 'transaction.duration',
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
        profileIds.has(row['profile.id'] as string)
      ) as ProfileItem[]) ?? []
    );
  }, [beforeProfilesQuery, profilesQuery]);

  const afterProfiles = useMemo(() => {
    const profileIds = new Set(
      (afterProfilesQuery.data?.data?.[0]?.['examples()'] as string[]) ?? []
    );

    return (
      (profilesQuery.data?.data?.filter(row =>
        profileIds.has(row['profile.id'] as string)
      ) as ProfileItem[]) ?? []
    );
  }, [afterProfilesQuery, profilesQuery]);

  const durationUnit = profilesQuery.data?.meta?.units?.['transaction.duration'] ?? '';

  return (
    <InterimSection
      type={SectionKey.REGRESSION_PROFILE_COMPARISON}
      title={t('Profile Comparison')}
    >
      <Wrapper>
        <div>
          <Header>{t('Example Profiles Before')}</Header>
          <EventList
            frameName={frameName}
            framePackage={framePackage}
            organization={organization}
            profiles={beforeProfiles}
            project={project}
            unit={durationUnit}
          />
        </div>
        <div>
          <Header>{t('Example Profiles After')}</Header>
          <EventList
            frameName={frameName}
            framePackage={framePackage}
            organization={organization}
            profiles={afterProfiles}
            project={project}
            unit={durationUnit}
          />
        </div>
      </Wrapper>
    </InterimSection>
  );
}

interface ProfileItem {
  'profile.id': string;
  timestamp: string;
  transaction: string;
  'transaction.duration': number;
}

interface EventListProps {
  frameName: string;
  framePackage: string;
  organization: Organization;
  profiles: ProfileItem[];
  project: Project;
  unit: string;
}

function EventList({
  frameName,
  framePackage,
  organization,
  profiles,
  project,
  unit,
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
      </NumberContainer>
      {profiles.map(item => {
        const target = generateProfileFlamechartRouteWithQuery({
          orgSlug: organization.slug,
          projectSlug: project.slug,
          profileId: item['profile.id'],
          query: {
            frameName,
            framePackage,
          },
        });

        return (
          <Fragment key={item['profile.id']}>
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
                {getShortEventId(item['profile.id'])}
              </Link>
            </Container>
            <Container>{item.transaction}</Container>
            <NumberContainer>
              {unit === 'millisecond' ? (
                <PerformanceDuration
                  milliseconds={item['transaction.duration']}
                  abbreviation
                />
              ) : (
                <PerformanceDuration
                  nanoseconds={item['transaction.duration']}
                  abbreviation
                />
              )}
            </NumberContainer>
          </Fragment>
        );
      })}
    </ListContainer>
  );
}

const Header = styled('h6')`
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(1)};
`;

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 1fr 1fr;
  }
`;

const ListContainer = styled('div')`
  display: grid;
  grid-template-columns: minmax(75px, 1fr) auto minmax(75px, 1fr);
  gap: ${space(1)};
`;
