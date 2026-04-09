import {Fragment} from 'react';
import styled from '@emotion/styled';

import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {useDrawer} from 'sentry/components/globalDrawer';
import {IconStack} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SidebarSectionTitle} from 'sentry/views/issueDetails/streamline/sidebar/sidebar';
import {SupergroupDetailDrawer} from 'sentry/views/issueList/supergroups/supergroupDrawer';
import {useSuperGroups} from 'sentry/views/issueList/supergroups/useSuperGroups';

interface SupergroupSectionProps {
  group: Group;
}

export function SupergroupSection({group}: SupergroupSectionProps) {
  const organization = useOrganization();
  const {openDrawer} = useDrawer();
  const {data: lookup, isLoading} = useSuperGroups([group.id]);
  const supergroup = lookup[group.id];

  if (!organization.features.includes('top-issues-ui')) {
    return null;
  }

  if (isLoading || !supergroup) {
    return null;
  }

  const issueCount = supergroup.group_ids.length;

  const handleClick = () => {
    openDrawer(
      () => (
        <SupergroupDetailDrawer supergroup={supergroup} matchedGroupIds={[group.id]} />
      ),
      {
        ariaLabel: t('Supergroup details'),
        drawerKey: 'supergroup-drawer',
      }
    );
  };

  return (
    <div>
      <SidebarSectionTitle>{t('Supergroup')}</SidebarSectionTitle>
      <SupergroupCard onClick={handleClick} aria-label={t('Supergroup details')}>
        <InteractionStateLayer />
        <Flex gap="sm" align="start">
          <AccentIcon size="sm" />
          <Stack gap="xs" style={{overflow: 'hidden'}}>
            {supergroup.error_type ? (
              <Text size="sm" bold ellipsis>
                {supergroup.error_type}
              </Text>
            ) : null}
            <Text size="sm" variant="muted" ellipsis>
              {supergroup.title}
            </Text>
            <Flex gap="sm" align="center">
              {supergroup.code_area ? (
                <Fragment>
                  <Text size="xs" variant="muted" ellipsis>
                    {supergroup.code_area}
                  </Text>
                  <Dot />
                </Fragment>
              ) : null}
              <Text size="xs" variant="muted" style={{flexShrink: 0}}>
                {tn('%s issue', '%s issues', issueCount)}
              </Text>
            </Flex>
          </Stack>
        </Flex>
      </SupergroupCard>
    </div>
  );
}

const SupergroupCard = styled('button')`
  position: relative;
  width: 100%;
  padding: ${p => p.theme.space.md};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  cursor: pointer;
  background: transparent;
  text-align: left;
  font: inherit;
  color: inherit;
`;

const AccentIcon = styled(IconStack)`
  color: ${p => p.theme.tokens.graphics.accent.vibrant};
  flex-shrink: 0;
  margin-top: 2px;
`;

const Dot = styled('div')`
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentcolor;
  flex-shrink: 0;
`;
