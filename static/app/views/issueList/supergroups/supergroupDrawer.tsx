import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {inlineCodeStyles} from '@sentry/scraps/code';
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
import {IconFocus} from 'sentry/icons';
import {t} from 'sentry/locale';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';

export function SupergroupDetailDrawer({supergroup}: {supergroup: SupergroupDetail}) {
  const organization = useOrganization();
  const groupListQueryParams = useMemo(
    () => ({
      query: `issue.id:[${supergroup.group_ids.join(',')}]`,
      limit: 25,
    }),
    [supergroup.group_ids]
  );
  const placeholderRows = Math.min(supergroup.group_ids.length, 10);

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
            to={`/organizations/${organization.slug}/issues/?query=issue.id:[${supergroup.group_ids.join(',')}]`}
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
          <Container padding="sm">
            <GroupList
              queryParams={groupListQueryParams}
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

const StyledMarkedText = styled(MarkedText)`
  code:not(pre code) {
    ${p => inlineCodeStyles(p.theme)};
  }
`;
