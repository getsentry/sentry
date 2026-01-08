import {Link} from 'react-router-dom';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import {ProjectAvatar} from 'sentry/components/core/avatar/projectAvatar';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {getTransactionSummaryBaseUrl} from 'sentry/views/performance/transactionSummary/utils';

interface SampleDrawerHeaderProps {
  transaction: string;
  project?: Project;
  subtitle?: string;
  transactionMethod?: string;
}

export function SampleDrawerHeaderTransaction(props: SampleDrawerHeaderProps) {
  const organization = useOrganization();

  const {project, subtitle, transaction, transactionMethod} = props;
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

      {subtitle ? (
        <Deemphasize>
          {subtitle}
          {DELIMITER}
        </Deemphasize>
      ) : null}

      {project ? (
        <TruncatedLink
          to={{
            pathname: getTransactionSummaryBaseUrl(organization, view),
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

const DELIMITER = ':';

const Bar = styled('h4')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  padding: 0;
  margin: 0;
  line-height: ${p => p.theme.text.lineHeightBody};

  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.normal};

  overflow: hidden;
`;

const Deemphasize = styled('span')`
  color: ${p => p.theme.subText};
`;

const TruncatedLink = styled(Link)`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const TruncatedSpan = styled('span')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
