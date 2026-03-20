import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {useDrawer} from 'sentry/components/globalDrawer';
import {IconFocus, IconGroup} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {SupergroupDetailDrawer} from 'sentry/views/issueList/supergroups/supergroupDrawer';
import type {SupergroupDetail} from 'sentry/views/issueList/supergroups/types';

interface Props {
  supergroup: SupergroupDetail;
}

/**
 * Show a badge indicating an issue belongs to a supergroup.
 */
export function IssueSuperGroup({supergroup}: Props) {
  const {openDrawer} = useDrawer();

  const tooltipTitle = (
    <Stack gap="sm">
      <Text size="sm" bold>
        {supergroup.title}
      </Text>

      <Stack gap="xs">
        <Text size="xs" variant="muted">
          {tn('%s issue', '%s issues', supergroup.group_ids.length)}
        </Text>
        {supergroup.error_type ? (
          <Flex align="baseline" gap="xs">
            <Text size="xs" variant="muted" bold>
              {t('Error:')}
            </Text>
            <Text size="xs" variant="muted">
              {supergroup.error_type}
            </Text>
          </Flex>
        ) : null}
        {supergroup.code_area ? (
          <Flex align="baseline" gap="xs">
            <Text size="xs" variant="muted" bold>
              {t('Location:')}
            </Text>
            <Text size="xs" variant="muted">
              {supergroup.code_area}
            </Text>
          </Flex>
        ) : null}
      </Stack>

      {supergroup.summary ? (
        <Stack gap="xs">
          <Flex align="center" gap="xs">
            <IconFocus size="xs" />
            <Text size="xs" bold>
              {t('Root Cause')}
            </Text>
          </Flex>
          <Text size="xs">{supergroup.summary}</Text>
        </Stack>
      ) : null}
    </Stack>
  );

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    openDrawer(() => <SupergroupDetailDrawer supergroup={supergroup} />, {
      ariaLabel: t('Supergroup details'),
      drawerKey: 'supergroup-drawer',
    });
  };

  return (
    <Tooltip title={tooltipTitle} skipWrapper>
      <SuperGroupButton onClick={handleClick} aria-label={t('supergroup')}>
        <IconGroup size="xs" />
        {`SG-${supergroup.id}`}
      </SuperGroupButton>
    </Tooltip>
  );
}

const SuperGroupButton = styled('button')`
  display: inline-flex;
  align-items: center;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  color: ${p => p.theme.colors.gray500};
  font-size: ${p => p.theme.font.size.sm};
  gap: 0 ${p => p.theme.space.xs};
  position: relative;

  &:hover {
    color: ${p => p.theme.tokens.interactive.link.accent.hover};
  }
`;
