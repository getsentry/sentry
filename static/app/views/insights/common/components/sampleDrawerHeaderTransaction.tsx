import {Link} from 'react-router-dom';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';
import {getTransactionSummaryBaseUrl} from 'sentry/views/performance/transactionSummary/utils';

import {useDomainViewFilters} from '../../pages/useFilters';

interface SampleDrawerHeaderProps {
  transaction: string;
  project?: Project;
  transactionMethod?: string;
}

export function SampleDrawerHeaderTransaction(props: SampleDrawerHeaderProps) {
  const organization = useOrganization();

  const {project, transaction, transactionMethod} = props;
  const {view} = useDomainViewFilters();

  const label =
    transaction && transactionMethod && !transaction.startsWith(transactionMethod)
      ? `${transactionMethod} ${transaction}`
      : transaction;

  return (
    <Bar>
      {project && (
        <ProjectAvatar
          project={project}
          direction="left"
          size={16}
          hasTooltip
          tooltip={project.slug}
        />
      )}

      {project ? (
        <TruncatedLink
          to={{
            pathname: getTransactionSummaryBaseUrl(organization.slug, view),
            search: qs.stringify({
              project: project.slug,
              transaction,
            }),
          }}
        >
          {label}
        </TruncatedLink>
      ) : (
        <TruncatedSpan>{label}</TruncatedSpan>
      )}
    </Bar>
  );
}

const Bar = styled('h4')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  padding: 0;
  margin: 0;

  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const TruncatedLink = styled(Link)`
  ${p => p.theme.overflowEllipsis}
`;

const TruncatedSpan = styled('span')`
  ${p => p.theme.overflowEllipsis}
`;
