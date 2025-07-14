import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import Version from 'sentry/components/version';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DebugIdBundleAssociation} from 'sentry/types/sourceMaps';
import {defined} from 'sentry/utils';

export function AssociatedReleases({
  associations,
  shouldFormatVersion,
}: {
  associations: DebugIdBundleAssociation[];
  shouldFormatVersion?: boolean;
}) {
  return (
    <ReleasesWrapper>
      {associations.length
        ? associations.map(association => (
            <AssociatedReleaseWrapper key={association.release}>
              <Tooltip
                showUnderline={association.exists === false}
                title={
                  association.exists === false ? t('Release does not exist') : undefined
                }
              >
                <StyledVersion
                  isPending={!defined(association.exists)}
                  version={association.release}
                  anchor={association.exists}
                  shouldFormatVersion={shouldFormatVersion}
                />
              </Tooltip>
              {`(Dist: ${formatDist(association.dist)})`}
            </AssociatedReleaseWrapper>
          ))
        : t('No releases associated with this upload.')}
    </ReleasesWrapper>
  );
}

const formatDist = (dist: string | string[] | null) => {
  if (Array.isArray(dist)) {
    return dist.join(', ');
  }
  if (dist === null) {
    return t('none');
  }
  return dist;
};

const ReleasesWrapper = styled('pre')`
  max-height: 200px;
  overflow-y: auto !important;
`;

const AssociatedReleaseWrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(0.5)};
  :not(:last-child) {
    margin-bottom: ${space(0.5)};
  }
`;

const StyledVersion = styled(Version)<{isPending: boolean}>`
  ${p =>
    p.isPending &&
    css`
      background-color: ${p.theme.backgroundTertiary};
      border-radius: ${p.theme.borderRadius};
      color: transparent;
      pointer-events: none;
      user-select: none;
    `}
`;
