import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {t} from 'sentry/locale';
import type {Deploy} from 'sentry/types/release';

interface DeployBadgeProps {
  deploy: Deploy;
  orgSlug: string;
  projectId: number;
  version: string;
}

export function DeployBadge(props: DeployBadgeProps) {
  return (
    <Link
      to={{
        pathname: `/organizations/${props.orgSlug}/issues/`,
        query: {
          project: props.projectId,
          environment: props.deploy.environment,
          query: new MutableSearch([`release:${props.version}`]).formatString(),
        },
      }}
    >
      <Tooltip title={t('Open In Issues')} skipWrapper>
        <TruncatedTag variant="info">{props.deploy.environment}</TruncatedTag>
      </Tooltip>
    </Link>
  );
}

const TruncatedTag = styled(Tag)`
  max-width: 96px;
`;
