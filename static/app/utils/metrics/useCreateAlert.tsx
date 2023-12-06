import {useMemo} from 'react';
import * as qs from 'query-string';

import {openModal} from 'sentry/actionCreators/modal';
import {Organization} from 'sentry/types';
import {parsePeriodToHours, statsPeriodToDays} from 'sentry/utils/dates';
import {
  getDDMInterval,
  isCustomMetric,
  isStandardMeasurement,
  isTransactionDuration,
  MetricsQuery,
} from 'sentry/utils/metrics';
import {formatMRIField, getUseCaseFromMRI, MRIToField} from 'sentry/utils/metrics/mri';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {AVAILABLE_TIME_PERIODS} from 'sentry/views/alerts/rules/metric/triggers/chart';
import {
  Dataset,
  EventTypes,
  TimePeriod,
  TimeWindow,
} from 'sentry/views/alerts/rules/metric/types';
import {CreateAlertModal} from 'sentry/views/ddm/createAlertModal';
import {OrganizationContext} from 'sentry/views/organizationContext';

interface FormState {
  environment: string | null;
  project: string | null;
}

export function getInitialFormState(metricsQuery: MetricsQuery): FormState {
  const project =
    metricsQuery.projects.length === 1 ? metricsQuery.projects[0].toString() : null;
  const environment =
    metricsQuery.environments.length === 1 && project
      ? metricsQuery.environments[0]
      : null;

  return {
    project,
    environment,
  };
}

export function getAlertPeriod(metricsQuery: MetricsQuery) {
  const {period, start, end} = metricsQuery.datetime;
  const inHours = statsPeriodToDays(period, start, end) * 24;

  switch (true) {
    case inHours <= 6:
      return TimePeriod.SIX_HOURS;
    case inHours <= 24:
      return TimePeriod.ONE_DAY;
    case inHours <= 3 * 24:
      return TimePeriod.THREE_DAYS;
    case inHours <= 7 * 24:
      return TimePeriod.SEVEN_DAYS;
    case inHours <= 14 * 24:
      return TimePeriod.FOURTEEN_DAYS;
    default:
      return TimePeriod.SEVEN_DAYS;
  }
}

const TIME_WINDOWS_TO_CHECK = [
  TimeWindow.ONE_MINUTE,
  TimeWindow.FIVE_MINUTES,
  TimeWindow.TEN_MINUTES,
  TimeWindow.FIFTEEN_MINUTES,
  TimeWindow.THIRTY_MINUTES,
  TimeWindow.ONE_HOUR,
  TimeWindow.TWO_HOURS,
  TimeWindow.FOUR_HOURS,
  TimeWindow.ONE_DAY,
];

export function getAlertInterval(metricsQuery, period: TimePeriod) {
  const useCase = getUseCaseFromMRI(metricsQuery.mri) ?? 'custom';
  const interval = getDDMInterval(metricsQuery.datetime, useCase);
  const inMinutes = parsePeriodToHours(interval) * 60;

  function toInterval(timeWindow: TimeWindow) {
    return `${timeWindow}m`;
  }

  for (let index = 0; index < TIME_WINDOWS_TO_CHECK.length; index++) {
    const timeWindow = TIME_WINDOWS_TO_CHECK[index];
    if (inMinutes <= timeWindow && AVAILABLE_TIME_PERIODS[timeWindow].includes(period)) {
      return toInterval(timeWindow);
    }
  }

  return toInterval(TimeWindow.ONE_HOUR);
}

export function getAlertFormPath({
  organizationSlug,
  interval,
  statsPeriod,
  environment,
  project,
  aggregate,
  query,
}) {
  return `/organizations/${organizationSlug}/alerts/new/metric/?${qs.stringify({
    // Needed, so alerts-create also collects environment via event view
    createFromDiscover: true,
    dataset: Dataset.GENERIC_METRICS,
    eventTypes: EventTypes.TRANSACTION,
    aggregate,
    interval,
    statsPeriod,
    referrer: 'ddm',
    // Event type also needs to be added to the query
    query,
    environment,
    project,
  })}`;
}

export function useCreateAlert(organization: Organization, metricsQuery: MetricsQuery) {
  const router = useRouter();
  const {projects} = useProjects();

  const statsPeriod = useMemo(() => getAlertPeriod(metricsQuery), [metricsQuery]);
  const interval = useMemo(
    () => getAlertInterval(metricsQuery, statsPeriod),
    [metricsQuery, statsPeriod]
  );

  const {project, environment} = getInitialFormState(metricsQuery);
  const projectSlug = projects.find(p => p.id === project)?.slug;

  return useMemo(() => {
    if (
      !metricsQuery.mri ||
      !metricsQuery.op ||
      !organization.access.includes('alerts:write')
    ) {
      return undefined;
    }
    return function () {
      if (isCustomMetric(metricsQuery)) {
        return openModal(deps => (
          <OrganizationContext.Provider value={organization}>
            <CreateAlertModal metricsQuery={metricsQuery} {...deps} />
          </OrganizationContext.Provider>
        ));
      }
      if (isTransactionDuration(metricsQuery)) {
        return router.push(
          getAlertFormPath({
            organizationSlug: organization.slug,
            aggregate: `${metricsQuery.op!}(transaction.duration)`,
            query: `${metricsQuery.query} event.type:transaction`.trim(),
            interval,
            statsPeriod,
            environment,
            project: projectSlug,
          })
        );
      }
      if (isStandardMeasurement(metricsQuery)) {
        return router.push(
          getAlertFormPath({
            organizationSlug: organization.slug,
            aggregate: formatMRIField(MRIToField(metricsQuery.mri, metricsQuery.op!)),
            query: `${metricsQuery.query} event.type:transaction`.trim(),
            interval,
            statsPeriod,
            environment,
            project: projectSlug,
          })
        );
      }
      return null;
    };
  }, [
    metricsQuery,
    organization,
    router,
    interval,
    statsPeriod,
    environment,
    projectSlug,
  ]);
}
