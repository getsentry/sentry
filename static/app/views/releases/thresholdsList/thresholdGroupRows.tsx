import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {IconAdd, IconEllipsis} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getExactDuration} from 'sentry/utils/formatters';

import {Threshold} from '../utils/types';

type NewThreshold = {
  environment: string;
  project: string;
  thresholdType: string;
  triggerType: string;
  value: number;
  window: number;
};

type Props = {
  columns: number;
  refetch: () => void;
  thresholds: Threshold[];
};

export function ThresholdGroupRows({thresholds, columns}: Props) {
  const [editing, setEditing] = useState<string[]>([]); // threshold ids (maybe make this a set?)
  const [newThresholds, setNewThresholds] = useState<Threshold[]>([]); // list of thresholds that have not been saved yet
  // const [editingIds, setEditingIds] = useState();
  const projectId = thresholds[0].project;
  const environment = thresholds[0].environment;
  const defaultWindow = thresholds[0].window_in_seconds;
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

  const initializeNewThreshold = () => {
    const newThreshold = {
      environment,
      project: projectId,
      window_in_seconds: defaultWindow,
      threshold_type: '',
      trigger_type: '',
      value: 0,
    };
    setNewThresholds([...newThresholds, newThreshold]);
  };

  const saveThreshold = () => {
    // TODO: we need to identify which threshold is being saved
    // refetch thresholds
    // If we refetch thresholds - then this fragment will likely unmount...
    // meaning any unsaved states will be reset
    // But - maybe not due to the proj-env key?
    // IF NOT
    //  on success - remove saved threshold from the new thresholds list (_should_ be auto-populated into the passed thresholds)
    //  OR remove threshold id from editing list
  };

  const thresholdList = [...thresholds, ...newThresholds];
  return (
    <StyledThresholdGroup columns={columns}>
      {thresholdList.map((threshold: Threshold, idx: number) => (
        <StyledRow
          key={`${projectId}-${environment}-${idx}-${thresholdList.length}`}
          lastRow={idx === thresholdList.length - 1}
        >
          <FlexCenter style={{borderBottom: 0}}>
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
          <FlexCenter style={{borderBottom: 0}}>
            {idx === 0 ? threshold.environment.name || 'None' : ''}
          </FlexCenter>
          <FlexCenter>
            {getExactDuration(threshold.window_in_seconds, false, 'seconds')}
          </FlexCenter>
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
        </StyledRow>
      ))}
      <NewRowBtn size="xs" borderless onClick={initializeNewThreshold}>
        <IconAdd color="activeText" isCircled />
      </NewRowBtn>
    </StyledThresholdGroup>
  );
}

type StyledThresholdGroupProps = {
  columns: number;
};
const StyledThresholdGroup = styled('div')<StyledThresholdGroupProps>`
  display: contents;
`;

type StyledThresholdRowProps = {
  lastRow: boolean;
};
const StyledRow = styled('div')<StyledThresholdRowProps>`
  display: contents;
  > * {
    padding: ${space(2)};
    border-bottom: ${p => (p.lastRow ? 0 : '1px solid ' + p.theme.border)};
  }
`;

const NewRowBtn = styled(Button)`
  display: flex;
  grid-column-start: 1;
  grid-column-end: -1;
  align-items: center;
  justify-content: center;
  background: ${p => p.theme.backgroundSecondary};
  border-radius: 0;
  &:last-child {
    border-radius: ${p => p.theme.borderRadiusBottom};
  }
`;

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
