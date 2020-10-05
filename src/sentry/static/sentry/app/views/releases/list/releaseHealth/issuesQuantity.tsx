import React from 'react';
import styled from '@emotion/styled';

import {t, tn} from 'app/locale';
import Tooltip from 'app/components/tooltip';
import Link from 'app/components/links/link';
import Count from 'app/components/count';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

import {getReleaseNewIssuesUrl} from '../../utils';

type Props = {
  orgSlug: string;
  newGroups: number;
  projectId: number;
  releaseVersion: string;
  isCompact?: boolean;
};

const IssuesQuantity = ({
  orgSlug,
  newGroups,
  projectId,
  releaseVersion,
  isCompact = false,
}: Props) => (
  <Tooltip title={t('Open in Issues')}>
    <Link to={getReleaseNewIssuesUrl(orgSlug, projectId, releaseVersion)}>
      {isCompact ? (
        <Issues>
          <StyledCount value={newGroups} />
          <span>{tn('issue', 'issues', newGroups)}</span>
        </Issues>
      ) : (
        <Count value={newGroups} />
      )}
    </Link>
  </Tooltip>
);

export default IssuesQuantity;

const Issues = styled('div')`
  display: grid;
  grid-gap: ${space(0.5)};
  grid-template-columns: auto max-content;
  justify-content: flex-end;
  align-items: center;
  text-align: end;
`;

// overflowEllipsis is useful if the count's value is over 1000000000
const StyledCount = styled(Count)`
  ${overflowEllipsis}
`;
