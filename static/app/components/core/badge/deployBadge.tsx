import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {Deploy} from 'sentry/types/release';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

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
        <TruncatedTag type="highlight">{props.deploy.environment}</TruncatedTag>
      </Tooltip>
    </Link>
  );
}

const TruncatedTag = styled(Tag)`
  max-width: 96px;
`;
