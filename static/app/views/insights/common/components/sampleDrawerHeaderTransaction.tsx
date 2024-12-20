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
  project: Project;
  transaction: string;
  transactionMethod?: string;
}

export function SampleDrawerHeaderTransaction(props: SampleDrawerHeaderProps) {
  const organization = useOrganization();

  const {project, transaction, transactionMethod} = props;
  const {view} = useDomainViewFilters();

  return (
    <Bar>
      <ProjectAvatar
        project={project}
        direction="left"
        size={16}
        hasTooltip
        tooltip={project.slug}
      />

      <Link
        to={{
          pathname: getTransactionSummaryBaseUrl(organization.slug, view),
          search: qs.stringify({
            project: project.slug,
            transaction,
          }),
        }}
      >
        {transaction && transactionMethod && !transaction.startsWith(transactionMethod)
          ? `${transactionMethod} ${transaction}`
          : transaction}
      </Link>
    </Bar>
  );
}

const Bar = styled('div')`
  display: flex;
  gap: ${space(1)};
`;
