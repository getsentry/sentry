import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Version} from 'sentry/components/version';
import {t} from 'sentry/locale';
import type {DebugIdBundleAssociation} from 'sentry/types/sourceMaps';
import {defined} from 'sentry/utils/defined';

export function AssociatedReleases({
  associations,
  shouldFormatVersion,
  projectId,
}: {
  associations: DebugIdBundleAssociation[];
  projectId: string;
  shouldFormatVersion?: boolean;
}) {
  return (
    <Stack gap="xs" maxHeight="200px" overflowY="auto">
      {associations.length
        ? associations.map(association => (
            <Flex key={association.release} wrap="wrap" gap="xs">
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
                  projectId={projectId}
                />
              </Tooltip>
              {`(Dist: ${formatDist(association.dist)})`}
            </Flex>
          ))
        : t('No releases associated with this upload.')}
    </Stack>
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

const StyledVersion = styled(Version)<{isPending: boolean}>`
  ${p =>
    p.isPending &&
    css`
      background-color: ${p.theme.tokens.background.tertiary};
      border-radius: ${p.theme.radius.md};
      color: transparent;
      pointer-events: none;
      user-select: none;
    `}
`;
