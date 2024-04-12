import Link from 'sentry/components/links/link';
import {Tag} from 'sentry/components/tag';
import {t} from 'sentry/locale';
import type {Deploy} from 'sentry/types';

type Props = {
  deploy: Deploy;
  orgSlug: string;
  projectId: number;
  version: string;
};

export default function DeployBadge({deploy, orgSlug, projectId, version}: Props) {
  return (
    <Link
      to={{
        pathname: `/organizations/${orgSlug}/issues/`,
        query: {
          project: projectId,
          environment: deploy.environment,
          query: {release: version},
        },
      }}
    >
      <Tag type="highlight" textMaxWidth={80} tooltipText={t('Open In Issues')}>
        {deploy.environment}
      </Tag>
    </Link>
  );
}
