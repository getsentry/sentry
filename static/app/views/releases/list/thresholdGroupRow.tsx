import {Fragment} from 'react';
import styled from '@emotion/styled';

import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {forHumans} from '../utils';
import {Threshold} from '../utils/types';

type Props = {
  thresholds: {[key: string]: any};
};

export function ThresholdGroupRow({thresholds}: Props) {
  const actions: MenuItemProps[] = [
    {
      key: 'edit',
      label: t('Edit'),
      onAction: () => {},
    },
    {
      key: 'delete',
      label: t('Delete'),
      priority: 'danger',
      onAction: () => {
        // console.log('oops');
      },
    },
  ];

  return thresholds.map((threshold: Threshold, idx: number) => (
    <Fragment key={idx}>
      <FlexCenter>
        {idx === 0 ? (
          <ProjectBadge
            project={threshold.project}
            avatarSize={16}
            hideOverflow
            disableLink
          />
        ) : (
          ''
        )}
      </FlexCenter>
      <FlexCenter>{idx === 0 ? threshold.environment.name || 'None' : ''}</FlexCenter>
      <FlexCenter>{forHumans(threshold.window_in_seconds)}</FlexCenter>
      <FlexCenter>
        {threshold.trigger_type === 'over' ? '>' : '<'} {threshold.threshold_type}
      </FlexCenter>
      <ActionsColumn>
        <DropdownMenu
          items={actions}
          position="bottom-end"
          triggerProps={{
            'aria-label': t('Actions'),
            size: 'xs',
            icon: <IconEllipsis size="xs" />,
            showChevron: false,
          }}
          // disabledKeys={hasAccess && canEdit ? [] : ['delete']}
        />
      </ActionsColumn>
    </Fragment>
  ));
}

const FlexCenter = styled('div')`
  display: flex;
  align-items: center;
`;

const ActionsColumn = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${space(1)};
`;
