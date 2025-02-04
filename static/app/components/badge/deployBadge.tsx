import Tag from 'sentry/components/badge/tag';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import type {Deploy} from 'sentry/types/release';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

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
          query: new MutableSearch([`release:${version}`]).formatString(),
        },
      }}
    >
      <Tag type="highlight" textMaxWidth={80} tooltipText={t('Open In Issues')}>
        {deploy.environment}
      </Tag>
    </Link>
  );
}
