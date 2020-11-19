import React from 'react';

<<<<<<< HEAD
=======
import {t} from 'app/locale';
import {Deploy} from 'app/types';
import Tag from 'app/components/tag';
>>>>>>> replaced deployBadge tagDeprecated with new tag
import Link from 'app/components/links/link';
import Tag from 'app/components/tagDeprecated';
import {IconOpen} from 'app/icons';
<<<<<<< HEAD
import {t} from 'app/locale';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Deploy} from 'app/types';
import {QueryResults, stringifyQueryObject} from 'app/utils/tokenizeSearch';
=======
import {stringifyQueryObject, QueryResults} from 'app/utils/tokenizeSearch';
>>>>>>> replaced deployBadge tagDeprecated with new tag

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
    <Tag className={className} type="highlight" icon={shouldLinkToIssues && <IconOpen />}>
      {deploy.environment}
    </Tag>
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

export default DeployBadge;
