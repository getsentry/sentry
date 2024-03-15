import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import type {APIRequestMethod} from 'sentry/api';
import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import Input from 'sentry/components/input';
import {IconAdd, IconClose, IconDelete, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types';
import {MonitorType} from 'sentry/types/alerts';
import {getExactDuration, parseLargestSuffix} from 'sentry/utils/formatters';
import {capitalize} from 'sentry/utils/string/capitalize';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {
  AlertRuleThresholdType,
  AlertRuleTriggerType,
  Dataset,
  EventTypes,
  type UnsavedMetricRule,
} from 'sentry/views/alerts/rules/metric/types';
import {MEPAlertsQueryType} from 'sentry/views/alerts/wizard/options';

import {
  CRASH_FREE_SESSION_RATE_STR,
  CRASH_FREE_USER_RATE_STR as _CRASH_FREE_USER_RATE_STR,
  FAILURE_RATE_STR as _FAILURE_RATE_STR,
  NEW_ISSUE_COUNT_STR,
  NEW_THRESHOLD_PREFIX,
  REGRESSED_ISSUE_COUNT_STR as _REGRESSED_ISSUE_COUNT_STR,
  TOTAL_ERROR_COUNT_STR,
  UNHANDLED_ISSUE_COUNT_STR as _UNHANDLED_ISSUE_COUNT_STR,
} from '../utils/constants';
import type {EditingThreshold, Threshold} from '../utils/types';

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

  const thresholdTypeList = useMemo(() => {
    const isInternal = organization.features?.includes('releases-v2-internal');
    const list = [
      {
        value: TOTAL_ERROR_COUNT_STR,
        textValue: 'Errors',
        label: 'Error Count',
      },
    ];

    if (isInternal) {
      list.push(
        {
          value: CRASH_FREE_SESSION_RATE_STR,
          textValue: 'Crash Free Sessions',
          label: 'Crash Free Sessions',
        },
        {
          value: NEW_ISSUE_COUNT_STR,
          textValue: 'New Issue Count',
          label: 'New Issue Count',
        }
      );
    }

    return list;
  }, [organization]);

  const windowOptions = thresholdType => {
    let options = [
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
    ];
    if (thresholdType !== CRASH_FREE_SESSION_RATE_STR) {
      options = [
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
        ...options,
      ];
    }
    return options;
  };

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

      // TODO - make sure this is behind the flag for organizations:activated-alert-rules
      const metricAlertData: UnsavedMetricRule & {name: string} = {
        name: `Release Alert Rule for ${thresholdData.project.slug} in ${submitData.environmentName}`,
        monitorType: MonitorType.ACTIVATED,
        aggregate: 'count()',
        dataset: Dataset.ERRORS,
        environment: submitData.environmentName || null,
        projects: [submitData.project.slug],
        query: '',
        resolveThreshold: null,
        thresholdPeriod: 1,
        thresholdType: AlertRuleThresholdType.ABOVE,
        timeWindow: submitData.windowValue,
        triggers: [
          {
            label: AlertRuleTriggerType.CRITICAL,
            alertThreshold: submitData.value,
            actions: [
              /* TODO - need to ask nathan about this */
            ],
          },
        ],
        comparisonDelta: null,
        eventTypes: [EventTypes.ERROR],
        owner: null,
        queryType: MEPAlertsQueryType.ERROR,
      };

      const metricAlertRequest = api.requestPromise(
        `/api/0/organizations/${organization.slug}/alert-rules/`,
        {
          method,
          data: metricAlertData,
        }
      );

      const request = api.requestPromise(path, {
        method,
        data: submitData,
      });

      Promise.all([metricAlertRequest, request])
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

      request.then(refetch).catch(_err => {
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
    onFormClose?.(thresholdId);
  };

  const editThresholdState = (thresholdId, key, value) => {
    if (editingThresholds[thresholdId]) {
      const updateEditing = JSON.parse(JSON.stringify(editingThresholds));
      const currentThresholdValues = updateEditing[thresholdId];

      updateEditing[thresholdId][key] = value;

      if (key === 'threshold_type' && value === CRASH_FREE_SESSION_RATE_STR) {
        if (['seconds', 'minutes'].indexOf(currentThresholdValues.windowSuffix) > -1) {
          updateEditing[thresholdId].windowSuffix = 'hours';
        }
      }

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
                value={(threshold as EditingThreshold).environmentName || ''}
                onChange={selectedOption =>
                  editThresholdState(
                    threshold.id,
                    'environmentName',
                    selectedOption.value
                  )
                }
                options={[
                  {
                    value: '',
                    textValue: '',
                    label: '',
                  },
                  ...allEnvironmentNames.map(env => ({
                    value: env,
                    textValue: env,
                    label: env,
                  })),
                ]}
              />
            ) : (
              <FlexCenter>
                {/* '' means it _has_ an environment, but the env has no name */}
                {(threshold as Threshold).environment
                  ? (threshold as Threshold).environment.name || ''
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
                    options={windowOptions(threshold.threshold_type)}
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
                    options={thresholdTypeList}
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
                        initialThreshold?.environment
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
