import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';
import moment from 'moment';

import {APIRequestMethod} from 'sentry/api';
import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import Input from 'sentry/components/input';
import {IconAdd, IconClose, IconDelete, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';
import {getExactDuration, parseLargestSuffix} from 'sentry/utils/formatters';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

import {NEW_THRESHOLD_PREFIX} from '../utils/constants';
import {EditingThreshold, Threshold} from '../utils/types';

type Props = {
  allEnvironmentNames: string[];
  isLastRow: boolean;
  project: Project;
  refetch: () => void;
  setTempError: (msg: string) => void;
  newGroup?: boolean;
  onFormClose?: (id: string) => void;
  threshold?: Threshold;
};

export function ThresholdGroupRows({
  allEnvironmentNames,
  isLastRow,
  newGroup = false,
  onFormClose,
  project,
  refetch,
  setTempError,
  threshold: initialThreshold,
}: Props) {
  const [editingThresholds, setEditingThresholds] = useState<{
    [key: string]: EditingThreshold;
  }>(() => {
    const editingThreshold = {};
    if (newGroup) {
      const [windowValue, windowSuffix] = parseLargestSuffix(0);
      const id = `${NEW_THRESHOLD_PREFIX}`;
      const newGroupEdit = {
        id,
        project,
        windowValue,
        windowSuffix,
        threshold_type: 'total_error_count',
        trigger_type: 'over',
        value: 0,
        hasError: false,
      };
      editingThreshold[id] = newGroupEdit;
    }
    return editingThreshold;
  });
  const [newThresholdIterator, setNewThresholdIterator] = useState<number>(0); // used simply to initialize new threshold
  const api = useApi();
  const organization = useOrganization();

  const thresholdIdSet = useMemo(() => {
    const initial = new Set<string>([]);
    if (initialThreshold) {
      initial.add(initialThreshold.id);
    }
    return new Set([...initial, ...Object.keys(editingThresholds)]);
  }, [initialThreshold, editingThresholds]);

  const initializeNewThreshold = (
    environmentName: string | undefined = undefined,
    defaultWindow: number = 0
  ) => {
    if (!project) {
      setTempError('No project provided');
      return;
    }
    const thresholdId = `${NEW_THRESHOLD_PREFIX}-${newThresholdIterator}`;
    const [windowValue, windowSuffix] = parseLargestSuffix(defaultWindow);
    const newThreshold: EditingThreshold = {
      id: thresholdId,
      project,
      environmentName,
      windowValue,
      windowSuffix,
      threshold_type: 'total_error_count',
      trigger_type: 'over',
      value: 0,
      hasError: false,
    };
    const updatedEditingThresholds = {...editingThresholds};
    updatedEditingThresholds[thresholdId] = newThreshold;
    setEditingThresholds(updatedEditingThresholds);
    setNewThresholdIterator(newThresholdIterator + 1);
  };

  const enableEditThreshold = (threshold: Threshold) => {
    const updatedEditingThresholds = {...editingThresholds};
    const [windowValue, windowSuffix] = parseLargestSuffix(threshold.window_in_seconds);
    updatedEditingThresholds[threshold.id] = {
      ...JSON.parse(JSON.stringify(threshold)), // Deep copy the original threshold object
      environmentName: threshold.environment ? threshold.environment.name : '', // convert environment to string for editing
      windowValue,
      windowSuffix,
      hasError: false,
    };
    setEditingThresholds(updatedEditingThresholds);
  };

  const saveThreshold = (saveIds: string[]) => {
    saveIds.forEach(id => {
      const thresholdData = editingThresholds[id];
      const seconds = moment
        .duration(thresholdData.windowValue, thresholdData.windowSuffix)
        .as('seconds');
      if (!thresholdData.project) {
        setTempError('Project required');
        return;
      }
      const submitData = {
        ...thresholdData,
        environment: thresholdData.environmentName,
        window_in_seconds: seconds,
      };
      let path = `/projects/${organization.slug}/${thresholdData.project.slug}/release-thresholds/${id}/`;
      let method: APIRequestMethod = 'PUT';
      if (id.includes(NEW_THRESHOLD_PREFIX)) {
        path = `/projects/${organization.slug}/${thresholdData.project.slug}/release-thresholds/`;
        method = 'POST';
      }
      const request = api.requestPromise(path, {
        method,
        data: submitData,
      });
      request
        .then(() => {
          refetch();
          closeEditForm(id);
          if (onFormClose) {
            onFormClose(id);
          }
        })
        .catch(_err => {
          setTempError('Issue saving threshold');
          setEditingThresholds(prevState => {
            const errorThreshold = {
              ...submitData,
              hasError: true,
            };
            const updatedEditingThresholds = {...prevState};
            updatedEditingThresholds[id] = errorThreshold;
            return updatedEditingThresholds;
          });
        });
    });
  };

  const deleteThreshold = thresholdId => {
    const updatedEditingThresholds = {...editingThresholds};
    const thresholdData = editingThresholds[thresholdId];
    const path = `/projects/${organization.slug}/${thresholdData.project.slug}/release-thresholds/${thresholdId}/`;
    const method = 'DELETE';
    if (!thresholdId.includes(NEW_THRESHOLD_PREFIX)) {
      const request = api.requestPromise(path, {
        method,
      });
      request
        .then(() => {
          refetch();
        })
        .catch(_err => {
          setTempError('Issue deleting threshold');
          const errorThreshold = {
            ...thresholdData,
            hasError: true,
          };
          updatedEditingThresholds[thresholdId] = errorThreshold as EditingThreshold;
          setEditingThresholds(updatedEditingThresholds);
        });
    }
    delete updatedEditingThresholds[thresholdId];
    setEditingThresholds(updatedEditingThresholds);
  };

  const closeEditForm = thresholdId => {
    const updatedEditingThresholds = {...editingThresholds};
    delete updatedEditingThresholds[thresholdId];
    setEditingThresholds(updatedEditingThresholds);
    if (onFormClose) {
      onFormClose(thresholdId);
    }
  };

  const editThresholdState = (thresholdId, key, value) => {
    if (editingThresholds[thresholdId]) {
      const updateEditing = JSON.parse(JSON.stringify(editingThresholds));
      updateEditing[thresholdId][key] = value;
      setEditingThresholds(updateEditing);
    }
  };

  return (
    <StyledThresholdGroup>
      {Array.from(thresholdIdSet).map((tId: string, idx: number) => {
        const isEditing = tId in editingThresholds;
        // NOTE: we're casting the threshold type because we can't dynamically derive type below
        const threshold = isEditing
          ? (editingThresholds[tId] as EditingThreshold)
          : (initialThreshold as Threshold);

        return (
          <StyledRow
            key={threshold.id}
            lastRow={isLastRow && idx === thresholdIdSet.size - 1}
            hasError={isEditing && (threshold as EditingThreshold).hasError}
          >
            {/* ENV ONLY EDITABLE IF NEW */}
            {!initialThreshold || threshold.id !== initialThreshold.id ? (
              <CompactSelect
                style={{width: '100%'}}
                value={(threshold as EditingThreshold).environmentName}
                onChange={selectedOption =>
                  editThresholdState(
                    threshold.id,
                    'environmentName',
                    selectedOption.value
                  )
                }
                options={allEnvironmentNames.map(env => ({
                  value: env,
                  textValue: env,
                  label: env,
                }))}
              />
            ) : (
              <FlexCenter>
                {/* 'None' means it _has_ an environment, but the env has no name */}
                {(threshold as Threshold).environment
                  ? (threshold as Threshold).environment.name || 'None'
                  : '{No environment}'}
              </FlexCenter>
            )}
            {/* FOLLOWING COLUMNS ARE EDITABLE */}
            {isEditing ? (
              <Fragment>
                <FlexCenter>
                  <Input
                    style={{width: '50%'}}
                    value={(threshold as EditingThreshold).windowValue}
                    type="number"
                    min={0}
                    onChange={e =>
                      editThresholdState(threshold.id, 'windowValue', e.target.value)
                    }
                  />
                  <CompactSelect
                    style={{width: '50%'}}
                    value={(threshold as EditingThreshold).windowSuffix}
                    onChange={selectedOption =>
                      editThresholdState(
                        threshold.id,
                        'windowSuffix',
                        selectedOption.value
                      )
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
                      editThresholdState(
                        threshold.id,
                        'threshold_type',
                        selectedOption.value
                      )
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
                      onClick={() =>
                        editThresholdState(threshold.id, 'trigger_type', 'under')
                      }
                    >
                      &gt;
                    </Button>
                  ) : (
                    <Button
                      onClick={() =>
                        editThresholdState(threshold.id, 'trigger_type', 'over')
                      }
                    >
                      &lt;
                    </Button>
                  )}
                  <Input
                    value={threshold.value}
                    type="number"
                    min={0}
                    onChange={e =>
                      editThresholdState(threshold.id, 'value', e.target.value)
                    }
                  />
                </FlexCenter>
              </Fragment>
            ) : (
              <Fragment>
                <FlexCenter>
                  {getExactDuration(
                    (threshold as Threshold).window_in_seconds || 0,
                    false,
                    'seconds'
                  )}
                </FlexCenter>
                <FlexCenter>
                  <div>
                    {threshold.threshold_type
                      .split('_')
                      .map(word => capitalize(word))
                      .join(' ')}
                  </div>
                  <div>&nbsp;{threshold.trigger_type === 'over' ? '>' : '<'}&nbsp;</div>
                  <div>{threshold.value}</div>
                </FlexCenter>
              </Fragment>
            )}
            {/* END OF EDITABLE COLUMNS */}
            <ActionsColumn>
              {isEditing ? (
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
                <Fragment>
                  <Button
                    aria-label={t('Edit threshold')}
                    icon={<IconEdit />}
                    onClick={() => enableEditThreshold(threshold as Threshold)}
                    size="xs"
                  />
                  <Button
                    aria-label={t('New Threshold')}
                    icon={<IconAdd color="activeText" isCircled />}
                    onClick={() =>
                      initializeNewThreshold(
                        initialThreshold && initialThreshold.environment
                          ? initialThreshold.environment.name
                          : undefined,
                        initialThreshold ? initialThreshold.window_in_seconds : 0
                      )
                    }
                    size="xs"
                  />
                </Fragment>
              )}
            </ActionsColumn>
          </StyledRow>
        );
      })}
    </StyledThresholdGroup>
  );
}

const StyledThresholdGroup = styled('div')`
  display: contents;
`;

type StyledThresholdRowProps = {
  lastRow: boolean;
  hasError?: boolean;
};
const StyledRow = styled('div')<StyledThresholdRowProps>`
  display: contents;
  > * {
    padding: ${space(2)};
    background-color: ${p =>
      p.hasError ? 'rgba(255, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0)'};
    border-bottom: ${p => (p.lastRow ? 0 : '1px solid ' + p.theme.border)};
  }
`;

const FlexCenter = styled('div')`
  display: flex;
  align-items: center;
  > * {
    margin: 0 ${space(1)};
  }
`;

const ActionsColumn = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-around;
`;
