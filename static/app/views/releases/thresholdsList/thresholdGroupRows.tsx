import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {IconAdd, IconDelete, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getExactDuration} from 'sentry/utils/formatters';

import {Threshold} from '../utils/types';

type Props = {
  columns: number;
  refetch: () => void;
  thresholds: Threshold[];
};

export function ThresholdGroupRows({thresholds, columns}: Props) {
  const [editing, setEditing] = useState(new Set<string>([]));
  const [newThresholds, setNewThresholds] = useState<Threshold[]>([]); // list of thresholds that have not been saved yet
  const projectId = thresholds[0].project;
  const environment = thresholds[0].environment;
  const defaultWindow = thresholds[0].window_in_seconds;

  const initializeNewThreshold = idx => {
    const id = `newthreshold-${idx}`;
    enableEditThreshold(id);
    const newThreshold = {
      id,
      environment,
      project: projectId,
      window_in_seconds: defaultWindow,
      threshold_type: '',
      trigger_type: '',
      value: 0,
    };
    setNewThresholds([...newThresholds, newThreshold]);
  };

  const enableEditThreshold = id => {
    const editingSet = new Set(editing);
    editingSet.add(id);
    setEditing(editingSet);
  };

  const saveThreshold = thresholdIds => {
    thresholdIds.forEach(id => {
      editing.delete(id);
      setEditing(new Set(editing));
    });
    // TODO: we need to identify which threshold is being saved
    // refetch thresholds
    // If we refetch thresholds - then this fragment will likely unmount...
    // meaning any unsaved states will be reset
    // But - maybe not due to the proj-env key?
    // IF NOT
    //  on success - remove saved threshold from the new thresholds list (_should_ be auto-populated into the passed thresholds)
    //  OR remove threshold id from editing list
  };

  const deleteThreshold = thresholdId => {
    if (thresholdId.includes('newthreshold')) {
      setNewThresholds(newThresholds.filter(item => item.id !== thresholdId));
    } else {
      // Set loading state
      console.log('need to send a request to delete threshold');
      // Send request
      // On success - remove threshold from thresholds list
      // OR - on success refetch?
      // Set loading state to false
    }
  };

  const thresholdList = [...thresholds, ...newThresholds];
  return (
    <StyledThresholdGroup columns={columns}>
      {thresholdList.map((threshold: Threshold, idx: number) => (
        <StyledRow key={threshold.id} lastRow={idx === thresholdList.length - 1}>
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
            {editing.has(threshold.id) ? (
              <Fragment>
                <Button size="xs" onClick={() => saveThreshold([threshold.id])}>
                  Save
                </Button>
                <StyledButton
                  aria-label={t('Delete threshold')}
                  borderless
                  icon={<IconDelete color="danger" />}
                  onClick={() => deleteThreshold(threshold.id)}
                  size="xs"
                />
              </Fragment>
            ) : (
              <StyledButton
                aria-label={t('Edit threshold')}
                borderless
                icon={<IconEdit />}
                onClick={() => enableEditThreshold(threshold.id)}
                size="xs"
              />
            )}
          </ActionsColumn>
        </StyledRow>
      ))}
      <NewRowBtn
        aria-label={t('Add new row')}
        borderless
        icon={<IconAdd color="activeText" isCircled />}
        onClick={() => initializeNewThreshold(thresholdList.length)}
        size="xs"
      />
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

const StyledButton = styled(Button)`
  margin-left: ${space(1)};
`;
