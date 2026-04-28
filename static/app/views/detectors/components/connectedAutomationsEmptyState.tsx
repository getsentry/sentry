import styled from '@emotion/styled';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {tct} from 'sentry/locale';
import type {AvatarProject} from 'sentry/types/project';

interface ConnectedAlertsEmptyStateProps {
  project: AvatarProject;
  children?: React.ReactNode;
}

export function ConnectedAlertsEmptyState({
  project,
  children,
}: ConnectedAlertsEmptyStateProps) {
  return (
    <Stack gap="lg" align="center" maxWidth="300px">
      {children && (
        <Stack gap="md" align="center">
          {children}
        </Stack>
      )}
      <Text variant="muted" align="center" density="comfortable">
        {tct(
          'Alerts configured for all Issues in the project [project] will also apply to this Monitor.',
          {
            project: (
              <InlineProjectName display="inline-flex" align="center" gap="xs">
                <ProjectAvatar project={project} size={16} />
                <strong>{project.slug}</strong>
              </InlineProjectName>
            ),
          }
        )}
      </Text>
    </Stack>
  );
}

const InlineProjectName = styled(Flex)`
  vertical-align: bottom;
`;
