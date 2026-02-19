import type React from 'react';
import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import {PanelTable} from 'sentry/components/panels/panelTable';
import TimeSince from 'sentry/components/timeSince';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import type {CodeReviewPR} from 'sentry/views/explore/prReview/types';
import {
  formatStatus,
  prStateToTagVariant,
  statusToTagVariant,
} from 'sentry/views/explore/prReview/utils';

interface Props {
  isLoading: boolean;
  pageLinks: string | null;
  paginationCaption: React.ReactNode;
  prs: CodeReviewPR[] | undefined;
}

export function PrReviewList({prs, isLoading, pageLinks, paginationCaption}: Props) {
  const organization = useOrganization();
  const navigate = useNavigate();

  const handleRowClick = useCallback(
    (pr: CodeReviewPR, e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest?.('a, button, input')) {
        return;
      }
      navigate(
        normalizeUrl(
          `/organizations/${organization.slug}/explore/pr-review/${pr.repositoryId}/${pr.prNumber}/`
        )
      );
    },
    [navigate, organization.slug]
  );

  if (isLoading) {
    return <LoadingIndicator />;
  }

  return (
    <Fragment>
      <StyledPanelTable
        headers={[
          t('Pull Request'),
          t('Status'),
          t('Reviews'),
          t('Comments'),
          t('Last Activity'),
        ]}
        isEmpty={!prs || prs.length === 0}
        emptyMessage={t('No pull requests found.')}
      >
        {prs?.map(pr => (
          <RowWrapper
            key={`${pr.repositoryId}-${pr.prNumber}`}
            onClick={e => handleRowClick(pr, e)}
          >
            <Flex direction="column" gap="xs">
              <div>
                {pr.prUrl ? (
                  <ExternalLink href={pr.prUrl}>
                    {pr.repositoryName ?? pr.repositoryId}#{pr.prNumber}{' '}
                    <IconOpen size="xs" />
                  </ExternalLink>
                ) : (
                  `${pr.repositoryName ?? pr.repositoryId}#${pr.prNumber}`
                )}
                {pr.prAuthor ? (
                  <Text as="span" variant="muted">
                    {' '}
                    {t('by %s', pr.prAuthor)}
                  </Text>
                ) : null}
              </div>
              <div>{pr.prTitle ?? t('Untitled')}</div>
            </Flex>
            <Flex direction="column" align="start" gap="xs">
              {pr.prState ? (
                <Tag variant={prStateToTagVariant(pr.prState)}>
                  {formatStatus(pr.prState)}
                </Tag>
              ) : null}
              <Tag variant={statusToTagVariant(pr.latestStatus)}>
                {formatStatus(pr.latestStatus)}
              </Tag>
            </Flex>
            <div>{pr.eventCount}</div>
            <div>{pr.totalComments}</div>
            <div>
              <TimeSince date={pr.lastActivity} />
            </div>
          </RowWrapper>
        ))}
      </StyledPanelTable>
      <Pagination pageLinks={pageLinks} caption={paginationCaption} />
    </Fragment>
  );
}

const StyledPanelTable = styled(PanelTable)`
  [data-test-id='table-header'] {
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

const RowWrapper = styled('div')`
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1;
  cursor: pointer;
  align-items: center;
  padding: 0;

  > * {
    padding: ${space(1)} ${space(2)};
  }

  &:hover {
    background-color: ${p => p.theme.tokens.background.secondary};
  }
`;
