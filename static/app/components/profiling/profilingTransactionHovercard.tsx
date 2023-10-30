import {Fragment, useEffect} from 'react';
import styled from '@emotion/styled';

import {Hovercard} from 'sentry/components/hovercard';
import {Flex} from 'sentry/components/profiling/flex';
import {
  FunctionsMiniGrid,
  FunctionsMiniGridEmptyState,
  FunctionsMiniGridLoading,
} from 'sentry/components/profiling/functionsMiniGrid';
import {TextTruncateOverflow} from 'sentry/components/profiling/textTruncateOverflow';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getShortEventId} from 'sentry/utils/events';
import {useProfilingTransactionQuickSummary} from 'sentry/utils/profiling/hooks/useProfilingTransactionQuickSummary';
import {
  generateProfileFlamechartRouteWithQuery,
  generateProfileSummaryRouteWithQuery,
} from 'sentry/utils/profiling/routes';
import {useLocation} from 'sentry/utils/useLocation';

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

  const triggerLink = (
    <Link
      to={linkToSummary}
      onClick={() =>
        trackAnalytics('profiling_views.go_to_transaction', {
          organization,
          source: 'transaction_hovercard.trigger',
        })
      }
    >
      {transaction}
    </Link>
  );

  return (
    <StyledHovercard
      delay={250}
      header={
        <Flex justify="space-between" align="center">
          <TextTruncateOverflow>{transaction}</TextTruncateOverflow>
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

export function ProfilingTransactionHovercardBody({
  transaction,
  project,
  organization,
}: ProfilingTransactionHovercardProps) {
  const {
    slowestProfile,
    slowestProfileQuery,
    slowestProfileDurationMultiplier,
    latestProfileQuery,
    latestProfile,
    functionsQuery,
    functions,
  } = useProfilingTransactionQuickSummary({
    transaction,
    project,
    referrer: 'api.profiling.transaction-hovercard',
  });

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

  useEffect(() => {
    trackAnalytics('profiling_ui_events.transaction_hovercard_view', {
      organization,
    });
  }, [organization]);

  return (
    <Flex gap={space(3)} column>
      <Flex justify="space-between">
        <ContextDetail
          title={t('Latest profile')}
          isLoading={latestProfileQuery.isLoading}
        >
          {latestProfile ? (
            <Link
              to={linkToFlamechartRoute(String(latestProfile['profile.id']))}
              onClick={() =>
                trackAnalytics('profiling_views.go_to_flamegraph', {
                  organization,
                  source: 'transaction_hovercard.latest_profile',
                })
              }
            >
              {getShortEventId(String(latestProfile!['profile.id']))}
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
                milliseconds={
                  slowestProfileDurationMultiplier *
                  (slowestProfile['transaction.duration'] as number)
                }
                abbreviation
              />
              <Link
                to={linkToFlamechartRoute(String(slowestProfile['profile.id']))}
                onClick={() =>
                  trackAnalytics('profiling_views.go_to_flamegraph', {
                    organization,
                    source: 'transaction_hovercard.slowest_profile',
                  })
                }
              >
                ({getShortEventId(String(slowestProfile['profile.id']))})
              </Link>
            </Flex>
          ) : (
            '-'
          )}
        </ContextDetail>
      </Flex>

      <Flex column h={125}>
        <ProfilingTransactionHovercardFunctions
          isLoading={functionsQuery.isLoading}
          functions={functions ?? []}
          organization={organization}
          project={project}
          onLinkClick={() =>
            trackAnalytics('profiling_views.go_to_flamegraph', {
              organization,
              source: 'transaction_hovercard.suspect_function',
            })
          }
        />
      </Flex>
    </Flex>
  );
}

type ProfilingTransactionHovercardFunctionsProps = React.ComponentProps<
  typeof FunctionsMiniGrid
> & {isLoading: boolean};

function ProfilingTransactionHovercardFunctions(
  props: ProfilingTransactionHovercardFunctionsProps
) {
  if (props.isLoading) {
    return <FunctionsMiniGridLoading />;
  }

  if (!props.functions || props.functions?.length === 0) {
    return <FunctionsMiniGridEmptyState />;
  }
  return <FunctionsMiniGrid {...props} />;
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
      {title && <UppercaseTitle>{title}</UppercaseTitle>}
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

const UppercaseTitle = styled('span')`
  text-transform: uppercase;
  font-size: ${p => p.theme.fontSizeExtraSmall};
  font-weight: 600;
  color: ${p => p.theme.subText};
`;

const StyledHovercard = styled(Hovercard)`
  width: 400px;
`;
