import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {IconAdd, IconClose, IconDelete, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getExactDuration, parseLargestSuffix} from 'sentry/utils/formatters';

import {Threshold} from '../utils/types';

const NEW_THRESHOLD_PREFIX = 'newthreshold';

type Props = {
  columns: number;
  refetch: () => void;
  thresholds: Threshold[];
};

type EditingThreshold = {
  windowSuffix?: string;
  windowValue?: number;
};

export function ThresholdGroupRows({thresholds, columns}: Props) {
  const [editingThresholds, setEditingThresholds] = useState<{
    [key: string]: Threshold & EditingThreshold;
  }>({});
  const [newThresholdIterator, setNewThresholdIterator] = useState<number>(0); // used simply to initialize new threshold
  const projectId = thresholds[0].project;
  const environment = thresholds[0].environment;
  const defaultWindow = thresholds[0].window_in_seconds;

  const thresholdsById = useMemo(() => {
    const byId = {};
    thresholds.forEach(threshold => {
      byId[threshold.id] = threshold;
    });
    return byId;
  }, [thresholds]);

  const thresholdIdSet = useMemo(() => {
    return new Set([
      ...thresholds.map(threshold => threshold.id),
      ...Object.keys(editingThresholds),
    ]);
  }, [thresholds, editingThresholds]);

  const initializeNewThreshold = () => {
    const thresholdId = `${NEW_THRESHOLD_PREFIX}-${newThresholdIterator}`;
    const [windowValue, windowSuffix] = parseLargestSuffix(defaultWindow);
    const newThreshold = {
      id: thresholdId,
      environment,
      project: projectId,
      window_in_seconds: defaultWindow,
      windowValue,
      windowSuffix,
      threshold_type: 'total_error_count',
      trigger_type: 'over',
      value: 0,
      windowDuration: 'seconds',
    };
    const updatedEditingThresholds = {...editingThresholds};
    updatedEditingThresholds[thresholdId] = newThreshold;
    setEditingThresholds(updatedEditingThresholds);
    setNewThresholdIterator(newThresholdIterator + 1);
  };

  const enableEditThreshold = thresholdId => {
    const updatedEditingThresholds = {...editingThresholds};
    const threshold = JSON.parse(JSON.stringify(thresholdsById[thresholdId]));
    const [windowValue, windowSuffix] = parseLargestSuffix(threshold.window_in_seconds);
    updatedEditingThresholds[thresholdId] = {
      ...threshold,
      windowValue,
      windowSuffix,
    };
    setEditingThresholds(updatedEditingThresholds);
  };

  const saveThreshold = thresholdIds => {
    thresholdIds(id => {
      closeEditForm(id);
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
    const updatedEditingThresholds = {...editingThresholds};
    if (!thresholdId.includes(NEW_THRESHOLD_PREFIX)) {
      // Set loading state
      console.log('need to send a request to delete threshold');
      // Send request
      // On success - remove threshold from thresholds list
      // OR - on success refetch?
      // Set loading state to false
    }
    delete updatedEditingThresholds[thresholdId];
    setEditingThresholds(updatedEditingThresholds);
  };

  const closeEditForm = thresholdId => {
    const updatedEditingThresholds = {...editingThresholds};
    delete updatedEditingThresholds[thresholdId];
    setEditingThresholds(updatedEditingThresholds);
  };

  const editThreshold = (thresholdId, key, value) => {
    if (editingThresholds[thresholdId]) {
      const updateEditing = JSON.parse(JSON.stringify(editingThresholds));
      updateEditing[thresholdId][key] = value;
      setEditingThresholds(updateEditing);
    }
  };

  return (
    <StyledThresholdGroup columns={columns}>
      {Array.from(thresholdIdSet).map((tId: string, idx: number) => {
        const threshold = editingThresholds[tId] || thresholdsById[tId];
        return (
          <StyledRow key={threshold.id} lastRow={idx === thresholdIdSet.size - 1}>
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
            {/* FOLLOWING COLUMNS ARE EDITABLE */}
            {editingThresholds[threshold.id] ? (
              <Fragment>
                <FlexCenter>
                  <input
                    style={{width: '50%'}}
                    value={threshold.windowValue}
                    type="number"
                    min={0}
                    onChange={e =>
                      editThreshold(threshold.id, 'windowValue', e.target.value)
                    }
                  />
                  <CompactSelect
                    style={{width: '50%'}}
                    value={threshold.windowSuffix}
                    onChange={selectedOption =>
                      editThreshold(threshold.id, 'windowSuffix', selectedOption.value)
                    }
                    options={[
                      {
                        value: 'seconds',
                        textValue: 'seconds',
                        label: 's',
                      },
                      {
                        value: 'minutes',
                        textValue: 'minutes',
                        label: 'min',
                      },
                      {
                        value: 'hours',
                        textValue: 'hours',
                        label: 'hrs',
                      },
                      {
                        value: 'days',
                        textValue: 'days',
                        label: 'days',
                      },
                    ]}
                  />
                </FlexCenter>
                <FlexCenter>
                  <CompactSelect
                    value={threshold.threshold_type}
                    onChange={selectedOption =>
                      editThreshold(threshold.id, 'threshold_type', selectedOption.value)
                    }
                    options={[
                      {
                        value: 'total_error_count',
                        textValue: 'Errors',
                        label: 'Error Count',
                      },
                    ]}
                  />
                  {threshold.trigger_type === 'over' ? (
                    <Button
                      onClick={() => editThreshold(threshold.id, 'trigger_type', 'under')}
                    >
                      &gt;
                    </Button>
                  ) : (
                    <Button
                      onClick={() => editThreshold(threshold.id, 'trigger_type', 'over')}
                    >
                      &lt;
                    </Button>
                  )}
                  <input
                    value={threshold.value}
                    type="number"
                    min={0}
                    onChange={e => editThreshold(threshold.id, 'value', e.target.value)}
                  />
                </FlexCenter>
              </Fragment>
            ) : (
              <Fragment>
                <FlexCenter>
                  {getExactDuration(threshold.window_in_seconds, false, 'seconds')}
                </FlexCenter>
                <FlexCenter>
                  <div>{threshold.threshold_type}</div>
                  <div>{threshold.trigger_type === 'over' ? '>' : '<'}</div>
                  <div>{threshold.value}</div>
                </FlexCenter>
              </Fragment>
            )}
            {/* END OF EDITABLE COLUMNS */}
            <ActionsColumn>
              {editingThresholds[threshold.id] ? (
                <Fragment>
                  <Button size="xs" onClick={() => saveThreshold([threshold.id])}>
                    Save
                  </Button>
                  {!threshold.id.includes(NEW_THRESHOLD_PREFIX) && (
                    <Button
                      aria-label={t('Delete threshold')}
                      borderless
                      icon={<IconDelete color="danger" />}
                      onClick={() => deleteThreshold(threshold.id)}
                      size="xs"
                    />
                  )}
                  <Button
                    aria-label={t('Close')}
                    borderless
                    icon={<IconClose />}
                    onClick={() => closeEditForm(threshold.id)}
                    size="xs"
                  />
                </Fragment>
              ) : (
                <Button
                  aria-label={t('Edit threshold')}
                  borderless
                  icon={<IconEdit />}
                  onClick={() => enableEditThreshold(threshold.id)}
                  size="xs"
                />
              )}
            </ActionsColumn>
          </StyledRow>
        );
      })}
      <NewRowBtn
        aria-label={t('Add new row')}
        borderless
        icon={<IconAdd color="activeText" isCircled />}
        onClick={initializeNewThreshold}
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
  grid-column-start: 3;
  grid-column-end: -1;
  align-items: center;
  justify-content: center;
  background: ${p => p.theme.backgroundSecondary};
  border-radius: 0;
`;

const FlexCenter = styled('div')`
  display: flex;
  align-items: center;
`;

const ActionsColumn = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-around;
`;
