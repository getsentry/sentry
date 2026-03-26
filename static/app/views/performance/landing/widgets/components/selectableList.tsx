import {Fragment} from 'react';
import styled from '@emotion/styled';

import {ExternalLink, Link} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {getConfigurePerformanceDocsLink} from 'sentry/utils/docs';
import {useProjects} from 'sentry/utils/useProjects';
import {CACHE_BASE_URL} from 'sentry/views/insights/cache/settings';
import {useModuleTitle} from 'sentry/views/insights/common/utils/useModuleTitle';
import {NoDataMessage} from 'sentry/views/insights/database/components/noDataMessage';
import {MODULE_DOC_LINK} from 'sentry/views/insights/http/settings';
import {MODULE_DOC_LINK as QUEUE_MODULE_DOC_LINK} from 'sentry/views/insights/queues/settings';
import {ModuleName} from 'sentry/views/insights/types';
import {getIsMultiProject} from 'sentry/views/performance/utils';

export const RightAlignedCell = styled('div')`
  text-align: right;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 ${p => p.theme.space.md};
`;

export const Subtitle = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  display: inline-block;
`;

export const GrowLink = styled(Link)`
  flex-grow: 1;
  display: inherit;
`;

export function GenericWidgetEmptyStateWarning({
  message,
  title,
}: {
  message: React.ReactNode;
  title?: string;
}) {
  return (
    <StyledEmptyStateWarning>
      <PrimaryMessage>{title ?? t('No results found')}</PrimaryMessage>
      <SecondaryMessage>{message}</SecondaryMessage>
    </StyledEmptyStateWarning>
  );
}

export function WidgetEmptyStateWarning() {
  return (
    <StyledEmptyStateWarning>
      <PrimaryMessage>{t('No results found')}</PrimaryMessage>
      <SecondaryMessage>
        {t(
          'Transactions may not be listed due to the filters above or a low sampling rate'
        )}
      </SecondaryMessage>
    </StyledEmptyStateWarning>
  );
}

export function TimeSpentInDatabaseWidgetEmptyStateWarning() {
  return (
    <StyledEmptyStateWarning>
      <PrimaryMessage>{t('No results found')}</PrimaryMessage>
      <SecondaryMessage>
        <NoDataMessage Wrapper={Fragment} isDataAvailable={false} />
      </SecondaryMessage>
    </StyledEmptyStateWarning>
  );
}

export function TimeConsumingDomainsWidgetEmptyStateWarning() {
  return (
    <StyledEmptyStateWarning>
      <PrimaryMessage>{t('No results found')}</PrimaryMessage>
      <SecondaryMessage>
        {tct(
          'Domains may be missing due to the filters above, a low sampling rate, or an error with instrumentation. Please see the [link] for more information.',
          {
            link: (
              <ExternalLink href={MODULE_DOC_LINK}>
                {t('Requests module documentation')}
              </ExternalLink>
            ),
          }
        )}
      </SecondaryMessage>
    </StyledEmptyStateWarning>
  );
}

export function QueuesWidgetEmptyStateWarning() {
  return (
    <StyledEmptyStateWarning>
      <PrimaryMessage>{t('No results found')}</PrimaryMessage>
      <SecondaryMessage>
        {tct(
          'Transactions may be missing due to the filters above, a low sampling rate, or an error with instrumentation. Please see the [link] for more information.',
          {
            link: (
              <ExternalLink href={QUEUE_MODULE_DOC_LINK}>
                {t('Queues module documentation')}
              </ExternalLink>
            ),
          }
        )}
      </SecondaryMessage>
    </StyledEmptyStateWarning>
  );
}

export function HighestCacheMissRateTransactionsWidgetEmptyStateWarning() {
  return (
    <StyledEmptyStateWarning>
      <PrimaryMessage>{t('No results found')}</PrimaryMessage>
      <SecondaryMessage>
        {tct(
          'Transactions may be missing due to the filters above, a low sampling rate, or an error with instrumentation. Please see the [link] for more information.',
          {
            link: (
              <ExternalLink href={`https://docs.sentry.io/product${CACHE_BASE_URL}`}>
                {t('Cache module documentation')}
              </ExternalLink>
            ),
          }
        )}
      </SecondaryMessage>
    </StyledEmptyStateWarning>
  );
}

export function WidgetAddInstrumentationWarning({type}: {type: 'db' | 'http'}) {
  const pageFilters = usePageFilters();
  const fullProjects = useProjects();
  const httpModuleTitle = useModuleTitle(ModuleName.HTTP);

  const projects = pageFilters.selection.projects;

  const isMultiProject = getIsMultiProject(projects);

  if (isMultiProject) {
    return <WidgetEmptyStateWarning />;
  }

  const project = fullProjects.projects.find(p => p.id === '' + projects[0]);
  const docsLink = getConfigurePerformanceDocsLink(project);

  if (!docsLink) {
    return <WidgetEmptyStateWarning />;
  }

  return (
    <StyledEmptyStateWarning>
      <PrimaryMessage>{t('No results found')}</PrimaryMessage>
      <SecondaryMessage>
        {tct(
          'No transactions with [spanCategory] spans found. You may need to add integrations to your [link] to capture these spans.',
          {
            spanCategory: type === 'db' ? t('Database') : httpModuleTitle,
            link: (
              <ExternalLink href={docsLink}>
                {t('performance monitoring setup')}
              </ExternalLink>
            ),
          }
        )}
      </SecondaryMessage>
    </StyledEmptyStateWarning>
  );
}

export function ListClose(props: {
  onClick: () => void;
  setSelectListIndex: (n: number) => void;
}) {
  return (
    <StyledTooltip title={t('Exclude this transaction from the search filter.')}>
      <StyledIconClose
        onClick={() => {
          props.onClick();
          props.setSelectListIndex(0);
        }}
      />
    </StyledTooltip>
  );
}

const StyledTooltip = styled(Tooltip)`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StyledIconClose = styled(IconClose)`
  cursor: pointer;
  color: ${p => p.theme.colors.gray200};
`;

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  justify-content: center;
  display: flex;
  align-items: center;
  flex-direction: column;
  flex: 1;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl} ${p => p.theme.space['3xl']}
    ${p => p.theme.space.xl};

  svg {
    margin-bottom: ${p => p.theme.space.md};
    height: 30px;
    width: 30px;
  }
`;

const PrimaryMessage = styled('span')`
  font-size: ${p => p.theme.font.size.md};
  color: ${p => p.theme.tokens.content.secondary};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin: 0 auto ${p => p.theme.space.md};
`;

const SecondaryMessage = styled('p')`
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
  max-width: 300px;
`;
