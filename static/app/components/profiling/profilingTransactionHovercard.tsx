import {CSSProperties, Fragment} from 'react';
import styled from '@emotion/styled';

import {Hovercard} from 'sentry/components/hovercard';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {DURATION_UNITS} from 'sentry/utils/discover/fieldRenderers';
import {getShortEventId} from 'sentry/utils/events';
import {useFunctions} from 'sentry/utils/profiling/hooks/useFunctions';
import {useProfileEvents} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {
  generateProfileFlamechartRouteWithQuery,
  generateProfileSummaryRouteWithQuery,
} from 'sentry/utils/profiling/routes';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {ContextTitle} from 'sentry/views/discover/table/quickContext/styles';
import {getProfilesTableFields} from 'sentry/views/profiling/profileSummary/content';

import {Button} from '../button';
import Link from '../links/link';
import LoadingIndicator from '../loadingIndicator';
import PerformanceDuration from '../performanceDuration';

interface ProfilingTransactionHovercardProps {
  organization: Organization;
  project: Project;
  transaction: string;
}

export function ProfilingTransactionHovercard(props: ProfilingTransactionHovercardProps) {
  const {project, transaction, organization} = props;
  const {query} = useLocation();

  const linkToSummary = generateProfileSummaryRouteWithQuery({
    query,
    orgSlug: organization.slug,
    projectSlug: project.slug,
    transaction,
  });

  const triggerLink = <Link to={linkToSummary}>{transaction}</Link>;

  if (!organization.features.includes('profiling-dashboard-redesign')) {
    return triggerLink;
  }

  return (
    <StyledHovercard
      delay={250}
      header={
        <Flex justify="space-between" align="center">
          <TextTruncate title={transaction}>{transaction}</TextTruncate>
          <Button to={linkToSummary} size="xs">
            {t('View Profiles')}
          </Button>
        </Flex>
      }
      body={
        <ProfilingTransactionHovercardBody
          transaction={transaction}
          project={project}
          organization={organization}
        />
      }
      showUnderline
    >
      {triggerLink}
    </StyledHovercard>
  );
}

function ProfilingTransactionHovercardBody({
  transaction,
  project,
  organization,
}: ProfilingTransactionHovercardProps) {
  const {selection} = usePageFilters();

  const baseQueryOptions = {
    query: `transaction:"${transaction}"`,
    fields: getProfilesTableFields(project.platform),
    enabled: Boolean(transaction),
    limit: 1,
    referrer: 'api.profiling.profiling-transaction-hovercard',
    refetchOnMount: false,
    projects: [project.id],
  };

  const slowestProfileQuery = useProfileEvents({
    ...baseQueryOptions,
    sort: {
      key: 'profile.duration',
      order: 'desc',
    },
  });

  const latestProfileQuery = useProfileEvents({
    ...baseQueryOptions,
    sort: {
      key: 'timestamp',
      order: 'desc',
    },
  });

  const functions = useFunctions({
    project,
    query: '',
    selection,
    transaction,
    sort: '-p99',
    functionType: 'application',
  });

  const slowestProfile = slowestProfileQuery?.data?.[0].data[0] ?? null;
  const durationUnits = slowestProfileQuery.data?.[0].meta.units['profile.duration'];
  const multiplier = durationUnits ? DURATION_UNITS[durationUnits] ?? 1 : 1;

  const latestProfile = latestProfileQuery?.data?.[0].data[0] ?? null;

  const linkToFlamechartRoute = (
    profileId: string,
    query?: {frameName: string; framePackage: string}
  ) => {
    return generateProfileFlamechartRouteWithQuery({
      orgSlug: organization.slug,
      projectSlug: project.slug,
      profileId,
      query,
    });
  };

  return (
    <Flex gap={space(3)} column>
      <Flex justify="space-between">
        <ContextDetail
          title={t('Latest profile')}
          isLoading={latestProfileQuery.isLoading}
        >
          {latestProfile ? (
            <Link to={linkToFlamechartRoute(String(latestProfile.id))}>
              {getShortEventId(String(latestProfile!.id))}
            </Link>
          ) : (
            '-'
          )}
        </ContextDetail>

        <ContextDetail
          title={t('Slowest profile')}
          isLoading={slowestProfileQuery.isLoading}
        >
          {slowestProfile ? (
            <Flex gap={space(1)}>
              <PerformanceDuration
                milliseconds={multiplier * (slowestProfile['profile.duration'] as number)}
                abbreviation
              />
              <Link to={linkToFlamechartRoute(String(slowestProfile.id))}>
                ({getShortEventId(String(slowestProfile?.id))})
              </Link>
            </Flex>
          ) : (
            '-'
          )}
        </ContextDetail>
      </Flex>

      <Flex column h={125}>
        <FunctionsMiniGrid>
          <FunctionsMiniGridHeader>{t('Slowest app functions')}</FunctionsMiniGridHeader>
          <FunctionsMiniGridHeader align="right">{t('P99')}</FunctionsMiniGridHeader>
          <FunctionsMiniGridHeader align="right">{t('Count')}</FunctionsMiniGridHeader>

          {functions.type === 'resolved' &&
            functions.data.functions.map(f => {
              const [exampleProfileIdRaw] = f.examples;
              const exampleProfileId = exampleProfileIdRaw.replaceAll('-', '');
              return (
                <Fragment key={f.name}>
                  <FunctionsMiniGridCell title={f.name}>
                    <TextTruncate>
                      <Link
                        to={linkToFlamechartRoute(exampleProfileId, {
                          frameName: f.name,
                          framePackage: f.package,
                        })}
                      >
                        {f.name}
                      </Link>
                    </TextTruncate>
                  </FunctionsMiniGridCell>
                  <FunctionsMiniGridCell align="right">
                    <PerformanceDuration nanoseconds={f.p99} abbreviation />
                  </FunctionsMiniGridCell>
                  <FunctionsMiniGridCell align="right">
                    <NumberContainer>{f.count}</NumberContainer>
                  </FunctionsMiniGridCell>
                </Fragment>
              );
            })}
        </FunctionsMiniGrid>
        {functions.type === 'loading' && (
          <Flex align="stretch" justify="center" column h="100%">
            <Flex align="center" justify="center">
              <LoadingIndicator mini />
            </Flex>
          </Flex>
        )}

        {functions.type === 'resolved' && functions.data.functions.length === 0 && (
          <Flex align="stretch" justify="center" column h="100%">
            <Flex align="center" justify="center">
              {t('No functions data')}
            </Flex>
          </Flex>
        )}
      </Flex>
    </Flex>
  );
}

interface ContextDetailProps {
  children: React.ReactNode;
  isLoading: boolean;
  title?: React.ReactNode;
}
function ContextDetail(props: ContextDetailProps) {
  const {title, children, isLoading} = props;

  return (
    <Flex column gap={space(1)}>
      {title && <ContextTitle>{title}</ContextTitle>}
      <Fragment>
        {isLoading ? (
          <Flex align="center" justify="center" h="1em">
            <LoadingIndicator mini />
          </Flex>
        ) : (
          children
        )}
      </Fragment>
    </Flex>
  );
}

const px = (val: string | number | undefined) =>
  typeof val === 'string' ? val : typeof val === 'number' ? val + 'px' : undefined;

// TODO(@eliashussary): move to common folder / bring up in fe-tsc
const Flex = styled('div')<{
  align?: CSSProperties['alignItems'];
  column?: boolean;
  gap?: number | string;
  h?: number | string;
  justify?: CSSProperties['justifyContent'];
  maxH?: number | string;
  minH?: number | string;
  w?: number | string;
}>`
  display: flex;
  flex-direction: ${p => (p.column ? 'column' : 'row')};
  justify-content: ${p => p.justify};
  align-items: ${p => p.align};
  gap: ${p => px(p.gap)};
  height: ${p => px(p.h)};
  width: ${p => px(p.w)};
  min-height: ${p => px(p.minH)};
`;

const FunctionsMiniGrid = styled('div')`
  display: grid;
  grid-template-columns: 60% 20% 20%;
`;

const FunctionsMiniGridHeader = styled('h6')<{align?: CSSProperties['textAlign']}>`
  color: ${p => p.theme.subText};
  text-align: ${p => p.align};
`;

const FunctionsMiniGridCell = styled('div')<{align?: CSSProperties['textAlign']}>`
  font-size: ${p => p.theme.fontSizeSmall};
  text-align: ${p => p.align};
  padding: ${space(0.5)} 0px;
`;

const NumberContainer = styled(`div`)`
  text-align: right;
`;

const StyledHovercard = styled(Hovercard)`
  width: 400px;
`;

const TextTruncate = styled('div')`
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;
