import Link from 'app/components/links/link';
import Tag from 'app/components/tag';
import {IconOpen} from 'app/icons';
import {t} from 'app/locale';
import {Deploy} from 'app/types';
import {QueryResults} from 'app/utils/tokenizeSearch';

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
    <Tag
      className={className}
      type="highlight"
      icon={shouldLinkToIssues && <IconOpen />}
      textMaxWidth={80}
      tooltipText={shouldLinkToIssues ? t('Open In Issues') : undefined}
    >
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
          query: new QueryResults([`release:${version!}`]).formatString(),
        },
      }}
    >
      {badge}
    </Link>
  );
};

export default DeployBadge;
