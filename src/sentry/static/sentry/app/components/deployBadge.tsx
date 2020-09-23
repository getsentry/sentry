import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import {Deploy} from 'app/types';
import Tag from 'app/components/tag';
import Link from 'app/components/links/link';
import {IconOpen} from 'app/icons';
import {stringifyQueryObject, QueryResults} from 'app/utils/tokenizeSearch';
import overflowEllipsis from 'app/styles/overflowEllipsis';

type Props = {
  deploy: Deploy;
  projectId?: number;
  orgSlug?: string;
  version?: string;
  className?: string;
};

const DeployBadge = ({deploy, orgSlug, projectId, version, className}: Props) => {
  const shouldLinkToIssues = !!orgSlug && !!version;

  const badge = (
    <Badge className={className}>
      <Label>{deploy.environment}</Label>
      {shouldLinkToIssues && <Icon size="xs" />}
    </Badge>
  );

  if (!shouldLinkToIssues) {
    return badge;
  }

  return (
    <Link
      to={{
        pathname: `/organizations/${orgSlug}/issues/`,
        query: {
          project: projectId ?? null,
          environment: deploy.environment,
          query: stringifyQueryObject(new QueryResults([`release:${version!}`])),
        },
      }}
      title={t('Open in Issues')}
    >
      {badge}
    </Link>
  );
};

const Badge = styled(Tag)`
  background-color: ${p => p.theme.gray700};
  color: ${p => p.theme.white};
  font-size: ${p => p.theme.fontSizeSmall};
  align-items: center;
  height: 20px;
`;

const Label = styled('span')`
  max-width: 100px;
  line-height: 20px;
  ${overflowEllipsis}
`;

const Icon = styled(IconOpen)`
  margin-left: ${space(0.5)};
  flex-shrink: 0;
`;

export default DeployBadge;
