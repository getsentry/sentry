import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';
import moment from 'moment';

import {APIRequestMethod} from 'sentry/api';
import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Input from 'sentry/components/input';
import {IconAdd, IconClose, IconDelete, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Environment, Project} from 'sentry/types';
import {getExactDuration, parseLargestSuffix} from 'sentry/utils/formatters';
import useApi from 'sentry/utils/useApi';

import {NEW_GROUP_PREFIX, NEW_THRESHOLD_PREFIX} from '../utils/constants';
import {EditingThreshold, NewThresholdGroup, Threshold} from '../utils/types';

type Props = {
  orgSlug: string;
  refetch: () => void;
  setError: (msg: string) => void;
  newGroup?: NewThresholdGroup;
  onFormClose?: (id: string) => void;
  thresholds?: Threshold[];
};

export function ThresholdGroupRows({
  thresholds = [],
  orgSlug,
  refetch,
  setError,
  newGroup,
  onFormClose,
}: Props) {
  const [editingThresholds, setEditingThresholds] = useState<{
    [key: string]: EditingThreshold;
  }>(() => {
    const editingThreshold = {};
    if (newGroup) {
      const [windowValue, windowSuffix] = parseLargestSuffix(0);
      const newGroupEdit = {
        id: newGroup.id,
        project: newGroup.project,
        windowValue,
        windowSuffix,
        threshold_type: 'total_error_count',
        trigger_type: 'over',
        value: 0,
        hasError: false,
      };
      editingThreshold[newGroup.id] = newGroupEdit;
    }
    return editingThreshold;
  });
  const [newThresholdIterator, setNewThresholdIterator] = useState<number>(0); // used simply to initialize new threshold
  const api = useApi();
  const initialProject =
    (thresholds[0] && thresholds[0].project) || (newGroup && newGroup.project);
  const initialEnv: Environment = thresholds[0] && thresholds[0].environment;
  const initialWindow = thresholds[0] && thresholds[0].window_in_seconds;

  const thresholdsById: {[id: string]: Threshold} = useMemo(() => {
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

  const initializeNewThreshold = (
    project: Project | undefined,
    environment: string | undefined = undefined,
    defaultWindow: number = 0
  ) => {
    if (!project) {
      setError('No project provided');
      return;
    }
    const thresholdId = `${NEW_THRESHOLD_PREFIX}-${newThresholdIterator}`;
    const [windowValue, windowSuffix] = parseLargestSuffix(defaultWindow);
    const newThreshold: EditingThreshold = {
      id: thresholdId,
      project,
      environment,
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

  const enableEditThreshold = thresholdId => {
    const updatedEditingThresholds = {...editingThresholds};
    const threshold = JSON.parse(JSON.stringify(thresholdsById[thresholdId]));
    const [windowValue, windowSuffix] = parseLargestSuffix(threshold.window_in_seconds);
    updatedEditingThresholds[thresholdId] = {
      ...threshold,
      environment: threshold.environment ? threshold.environment.name : '', // convert environment to string for editing
      windowValue,
      windowSuffix,
      hasError: false,
    };
    setEditingThresholds(updatedEditingThresholds);
  };

  const saveThreshold = (thresholdIds: string[]) => {
    thresholdIds.forEach(id => {
      const thresholdData = editingThresholds[id];
      const seconds = moment
        .duration(thresholdData.windowValue, thresholdData.windowSuffix)
        .as('seconds');
      if (!thresholdData.project) {
        setError('Project required');
        return;
      }
      const submitData = {
        ...thresholdData,
        window_in_seconds: seconds,
      };
      let path = `/projects/${orgSlug}/${thresholdData.project.slug}/release-thresholds/${id}/`;
      let method: APIRequestMethod = 'PUT';
      if (id.includes(NEW_THRESHOLD_PREFIX) || id.includes(NEW_GROUP_PREFIX)) {
        path = `/projects/${orgSlug}/${thresholdData.project.slug}/release-thresholds/`;
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
          setError('Issue saving threshold');
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
    const path = `/projects/${orgSlug}/${thresholdData.project.slug}/release-thresholds/${thresholdId}/`;
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
          setError('Issue deleting threshold');
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
        const threshold = editingThresholds[tId] || thresholdsById[tId];
        let environmentName;
        if (editingThresholds[tId]) {
          // editing environment type is String
          environmentName = editingThresholds[tId].environment;
        } else {
          // Threshold environment type is Environnment
          environmentName = thresholdsById[tId].environment
            ? thresholdsById[tId].environment.name
            : '';
        }
        return (
          <StyledRow
            key={threshold.id}
            lastRow={idx === thresholdIdSet.size - 1}
            hasError={threshold.hasError}
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
            {/* TODO: IF this is a new threshold - allow environment select */}
            {newGroup ? (
              <CompactSelect
                style={{width: '100%'}}
                value={threshold.environment}
                onChange={selectedOption =>
                  editThresholdState(threshold.id, 'environment', selectedOption.value)
                }
                options={newGroup.environments.map(env => ({
                  value: env,
                  textValue: env,
                  label: env,
                }))}
              />
            ) : (
              <FlexCenter style={{borderBottom: 0}}>
                {idx === 0 ? environmentName || 'None' : ''}
              </FlexCenter>
            )}
            {/* FOLLOWING COLUMNS ARE EDITABLE */}
            {editingThresholds[threshold.id] ? (
              <Fragment>
                <FlexCenter>
                  <Input
                    style={{width: '50%'}}
                    value={threshold.windowValue}
                    type="number"
                    min={0}
                    onChange={e =>
                      editThresholdState(threshold.id, 'windowValue', e.target.value)
                    }
                  />
                  <CompactSelect
                    style={{width: '50%'}}
                    value={threshold.windowSuffix}
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
                  {getExactDuration(threshold.window_in_seconds || 0, false, 'seconds')}
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
              {editingThresholds[threshold.id] ? (
                <Fragment>
                  <Button size="xs" onClick={() => saveThreshold([threshold.id])}>
                    Save
                  </Button>
                  {!(
                    threshold.id.includes(NEW_THRESHOLD_PREFIX) ||
                    threshold.id.includes(NEW_GROUP_PREFIX)
                  ) && (
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
      {!newGroup && (
        <NewRowBtn
          aria-label={t('Add new row')}
          borderless
          icon={<IconAdd color="activeText" isCircled />}
          onClick={() =>
            initializeNewThreshold(
              initialProject,
              initialEnv && initialEnv.name,
              initialWindow
            )
          }
          size="xs"
        />
      )}
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
    border-bottom: ${p => (p.lastRow ? 0 : '1px solid ' + p.theme.border)};
    background-color: ${p =>
      p.hasError ? 'rgba(255, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0)'};
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
  > * {
    margin: 0 ${space(1)};
  }
`;

const ActionsColumn = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-around;
`;
