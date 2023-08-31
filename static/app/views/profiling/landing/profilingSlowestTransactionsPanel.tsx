import {useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Button} from 'sentry/components/button';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {Flex} from 'sentry/components/profiling/flex';
import {
  FunctionsMiniGrid,
  FunctionsMiniGridEmptyState,
  FunctionsMiniGridLoading,
} from 'sentry/components/profiling/functionsMiniGrid';
import {TextTruncateOverflow} from 'sentry/components/profiling/textTruncateOverflow';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import {EventsResults, EventsResultsDataRow} from 'sentry/utils/profiling/hooks/types';
import {useProfileEvents} from 'sentry/utils/profiling/hooks/useProfileEvents';
import {useProfilingTransactionQuickSummary} from 'sentry/utils/profiling/hooks/useProfilingTransactionQuickSummary';
import {generateProfileSummaryRouteWithQuery} from 'sentry/utils/profiling/routes';
import {makeFormatTo} from 'sentry/utils/profiling/units/units';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

const fields = ['transaction', 'project.id', 'last_seen()', 'p95()', 'count()'] as const;
type SlowestTransactionsFields = (typeof fields)[number];

export function ProfilingSlowestTransactionsPanel() {
  const profilingTransactionsQuery = useProfileEvents({
    fields,
    sort: {
      key: 'p95()',
      order: 'desc',
    },
    limit: 3,
    query: 'count():>3',
    referrer: 'api.profiling.landing-slowest-transaction-panel',
  });

  const [openPanel, setOpenPanel] = useState<null | string>(null);

  const profilingTransactions = useMemo(
    () => profilingTransactionsQuery.data?.data ?? [],
    [profilingTransactionsQuery.data]
  );

  const transactionNames = useMemo(
    () => profilingTransactions.map(txn => txn.transaction),
    [profilingTransactions]
  );

  if (transactionNames.length > 0 && !transactionNames.includes(openPanel)) {
    const firstTransaction = transactionNames[0];
    setOpenPanel(firstTransaction as string);
  }

  const {isLoading} = profilingTransactionsQuery;
  const hasProfilingTransactions =
    !isLoading && profilingTransactions && profilingTransactions.length > 0;

  return (
    <FlexPanel>
      <Flex column h="100%">
        <Flex column p={space(1.5)}>
          <PanelHeading>{t('Slowest Transactions')}</PanelHeading>
          <PanelSubheading>
            {t('Slowest transactions that could use some optimization.')}
          </PanelSubheading>
        </Flex>

        {(isLoading || !hasProfilingTransactions) && (
          <Flex column align="center" justify="center" h="100%">
            {isLoading ? (
              <LoadingIndicator />
            ) : (
              !hasProfilingTransactions && (
                <Flex.Item>
                  <EmptyStateWarning>
                    <p>{t('No results found')}</p>
                    <EmptyStateDescription>
                      {t(
                        'Transactions may not be listed due to the filters above or a low number of profiles.'
                      )}
                    </EmptyStateDescription>
                  </EmptyStateWarning>
                </Flex.Item>
              )
            )}
          </Flex>
        )}

        {profilingTransactions?.map(transaction => {
          return (
            <SlowestTransactionPanelItem
              key={transaction.transaction as string}
              transaction={transaction}
              open={transaction.transaction === openPanel}
              onOpen={() => setOpenPanel(transaction.transaction as string)}
              units={profilingTransactionsQuery.data?.meta.units}
            />
          );
        })}
      </Flex>
    </FlexPanel>
  );
}
interface SlowestTransactionPanelItemProps {
  onOpen: () => void;
  open: boolean;
  transaction: EventsResultsDataRow<SlowestTransactionsFields>;
  units?: EventsResults<SlowestTransactionsFields>['meta']['units'];
}

function SlowestTransactionPanelItem({
  transaction,
  open,
  onOpen,
  units,
}: SlowestTransactionPanelItemProps) {
  const {query} = useLocation();

  const organization = useOrganization();
  const projects = useProjects();
  const transactionProject = useMemo(
    () => projects.projects.find(p => p.id === String(transaction['project.id'])),
    [projects.projects, transaction]
  );

  if (!transactionProject && !projects.fetching && projects.projects.length > 0) {
    return null;
  }

  const key: SlowestTransactionsFields = 'p95()';
  const formatter = makeFormatTo(
    units?.[key] ?? units?.[getAggregateAlias(key)] ?? 'nanoseconds',
    'milliseconds'
  );

  return (
    <PanelItem key={transaction.transaction as string}>
      <Flex justify="space-between" gap={space(1)}>
        <PlatformIcon platform={transactionProject?.platform ?? 'default'} />
        <Flex.Item
          grow={1}
          onClick={onOpen}
          css={{
            cursor: 'pointer',
          }}
        >
          <div
            css={{
              maxWidth: 'fit-content',
            }}
          >
            <Link
              to={generateProfileSummaryRouteWithQuery({
                query,
                orgSlug: organization.slug,
                projectSlug: transactionProject?.slug!,
                transaction: transaction.transaction as string,
              })}
              onClick={() => {
                trackAnalytics('profiling_views.go_to_transaction', {
                  source: 'slowest_transaction_panel',
                  organization,
                });
              }}
            >
              <TextTruncateOverflow>
                {transaction.transaction as string}
              </TextTruncateOverflow>
            </Link>
          </div>
        </Flex.Item>

        <PerformanceDuration
          milliseconds={formatter(transaction[key] as number)}
          abbreviation
        />
        <Button borderless size="zero" onClick={onOpen}>
          <IconChevron direction={open ? 'up' : 'down'} size="xs" />
        </Button>
      </Flex>
      <PanelItemBody
        style={{
          height: open ? 160 : 0,
        }}
      >
        {open && transactionProject && (
          <PanelItemFunctionsMiniGrid
            transaction={String(transaction.transaction)}
            organization={organization}
            project={transactionProject}
          />
        )}
      </PanelItemBody>
    </PanelItem>
  );
}

interface PanelItemFunctionsMiniGridProps {
  organization: Organization;
  project: Project;
  transaction: string;
}

function PanelItemFunctionsMiniGrid(props: PanelItemFunctionsMiniGridProps) {
  const {transaction, project, organization} = props;
  const {functionsQuery, functions} = useProfilingTransactionQuickSummary({
    transaction,
    project,
    referrer: 'api.profiling.landing-slowest-transaction-panel',
    skipLatestProfile: true,
    skipSlowestProfile: true,
  });

  if (functionsQuery.isLoading) {
    return <FunctionsMiniGridLoading />;
  }

  if (!functions || (functions && functions.length === 0)) {
    return <FunctionsMiniGridEmptyState />;
  }

  return (
    <PanelItemBodyInner>
      <FunctionsMiniGrid
        functions={functions}
        organization={organization}
        project={project}
        onLinkClick={() =>
          trackAnalytics('profiling_views.go_to_flamegraph', {
            organization,
            source: 'slowest_transaction_panel',
          })
        }
      />
    </PanelItemBodyInner>
  );
}

const FlexPanel = styled(Panel)`
  display: flex;
  flex-direction: column;
`;

const PanelHeading = styled('span')`
  font-size: ${p => p.theme.text.cardTitle.fontSize};
  font-weight: ${p => p.theme.text.cardTitle.fontWeight};
  line-height: ${p => p.theme.text.cardTitle.lineHeight};
`;

const PanelSubheading = styled('span')`
  color: ${p => p.theme.subText};
`;

const PanelItem = styled('div')`
  padding: ${space(1)} ${space(1.5)};
  border-top: 1px solid ${p => p.theme.border};
`;
const PanelItemBody = styled('div')`
  transition: height 0.1s ease;
  width: 100%;
  overflow: hidden;
`;

// TODO: simple layout stuff like this should come from a primitive component and we should really stop this `styled` nonsense
const PanelItemBodyInner = styled('div')`
  padding-top: ${space(1.5)};
`;

const EmptyStateDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;
