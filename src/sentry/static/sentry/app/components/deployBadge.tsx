import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import {Deploy} from 'app/types';
import Tag from 'app/views/settings/components/tag';
import Link from 'app/components/links/link';
import {IconOpen} from 'app/icons';
import {stringifyQueryObject} from 'app/utils/tokenizeSearch';

type Props = {
  deploy: Deploy;
  orgSlug?: string;
  version?: string;
  className?: string;
};

const DeployBadge = ({deploy, orgSlug, version, className}: Props) => {
  const shouldLinkToIssues = !!orgSlug && !!version;

  const badge = (
    <Badge shouldLinkToIssues={shouldLinkToIssues} className={className}>
      {deploy.environment}
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
          project: null,
          environment: deploy.environment,
          query: stringifyQueryObject({
            query: [],
            release: [version!],
          }),
        },
      }}
      title={t('Open in Issues')}
    >
      {badge}
    </Link>
  );
};

const Badge = styled(Tag)<{shouldLinkToIssues: boolean}>`
  background-color: ${p => p.theme.gray4};
  color: ${p => p.theme.white};
  font-size: ${p => p.theme.fontSizeSmall};
  display: inline-block;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  position: relative;
  padding-right: ${p => (p.shouldLinkToIssues ? '25px' : null)};
`;

const Icon = styled(IconOpen)`
  position: absolute;
  top: ${space(0.5)};
  right: ${space(1)};
`;

export default DeployBadge;
