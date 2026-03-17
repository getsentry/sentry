import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {
  CrumbContainer,
  NavigationCrumbs,
  ShortId,
} from 'sentry/components/events/eventDrawer';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import GroupList from 'sentry/components/issues/groupList';
import {ALL_ACCESS_PROJECTS} from 'sentry/components/pageFilters/constants';
import {IconFocus} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {StyledMarkedText} from 'sentry/views/issueList/pages/supergroups';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';

export function SupergroupDetailDrawer({supergroup}: {supergroup: SupergroupDetail}) {
  const organization = useOrganization();
  const placeholderRows = Math.min(supergroup.group_ids.length, 10);
  const issueIdQuery =
    supergroup.group_ids.length === 1
      ? `issue.id:${supergroup.group_ids[0]}`
      : `issue.id:[${supergroup.group_ids.join(',')}]`;

  return (
    <Fragment>
      <DrawerHeader hideBar>
        <Flex justify="between" align="center" gap="md" flexGrow={1}>
          <NavigationCrumbs
            crumbs={[
              {label: t('Supergroups')},
              {
                label: (
                  <CrumbContainer>
                    <ShortId>{`SG-${supergroup.id}`}</ShortId>
                  </CrumbContainer>
                ),
              },
            ]}
          />
          <Link
            to={{
              pathname: `/organizations/${organization.slug}/issues/`,
              query: {query: issueIdQuery, project: ALL_ACCESS_PROJECTS},
            }}
          >
            {t('View All Issues')} ({supergroup.group_ids.length})
          </Link>
        </Flex>
      </DrawerHeader>
      <DrawerContentBody>
        <Container padding="2xl" borderBottom="muted">
          <Stack gap="lg">
            <Heading as="h2" size="lg">
              <StyledMarkedText text={supergroup.title} inline as="span" />
            </Heading>

            <Flex wrap="wrap" gap="lg">
              {supergroup.error_type && (
                <Flex gap="xs">
                  <Text size="sm" variant="muted">
                    {t('Error')}
                  </Text>
                  <Text size="sm">{supergroup.error_type}</Text>
                </Flex>
              )}
              {supergroup.code_area && (
                <Flex gap="xs">
                  <Text size="sm" variant="muted">
                    {t('Location')}
                  </Text>
                  <Text size="sm">{supergroup.code_area}</Text>
                </Flex>
              )}
            </Flex>

            {supergroup.summary && (
              <Container background="secondary" border="primary" radius="md">
                <Flex direction="column" padding="md lg" gap="sm">
                  <Flex align="center" gap="xs">
                    <IconFocus size="xs" variant="promotion" />
                    <Text size="sm" bold>
                      {t('Root Cause')}
                    </Text>
                  </Flex>
                  <Text size="sm">
                    <StyledMarkedText text={supergroup.summary} inline as="span" />
                  </Text>
                </Flex>
              </Container>
            )}
          </Stack>
        </Container>

        {supergroup.group_ids.length > 0 && (
          <Container padding="xl 2xl">
            <GroupList
              queryParams={{
                query: issueIdQuery,
                limit: 25,
                project: ALL_ACCESS_PROJECTS,
              }}
              canSelectGroups={false}
              withChart={false}
              withPagination={false}
              source="supergroup-drawer"
              numPlaceholderRows={placeholderRows}
            />
          </Container>
        )}
      </DrawerContentBody>
    </Fragment>
  );
}

const DrawerContentBody = styled(DrawerBody)`
  padding: 0;
`;
