import styled from '@emotion/styled';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {DrawerHeader} from 'sentry/components/globalDrawer/components';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getShortEventId} from 'sentry/utils/events';

interface SeerDrawerHeaderProps {
  event: Event;
  group: Group;
  project: Project;
}

export function SeerDrawerHeader({group, project, event}: SeerDrawerHeaderProps) {
  return (
    <DrawerHeader>
      <Flex width="100%" justify="between">
        <NavigationCrumbs
          crumbs={[
            {
              label: (
                <Flex align="center" gap="md">
                  <ProjectAvatar project={project} />
                  <Text size="md" variant="muted">
                    {group.shortId}
                  </Text>
                </Flex>
              ),
            },
            {label: getShortEventId(event.id)},
            {label: t('Seer')},
          ]}
        />
      </Flex>
    </DrawerHeader>
  );
}

const NavigationCrumbs = styled(Breadcrumbs)`
  margin: 0;
  padding: 0;
`;
