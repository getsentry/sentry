import ScoreCard from 'sentry/components/scoreCard';
import {PageFilters} from 'sentry/types';
import {Organization, SessionApiResponse} from 'sentry/types/organization';
import useApiRequests from 'sentry/utils/useApiRequests';

type Props = {
  field: string;
  helpText: string;
  isProjectStabilized: boolean;
  organization: Organization;
  selection: PageFilters;
  title: string;
  hasTransactions?: boolean;
  query?: string;
};

type State = {
  current: SessionApiResponse;
  previous: SessionApiResponse;
};

function ProjectScoreCard({title, helpText, field}: Props) {
  function getParams(): Record<string, any> {
    const baseParams = {
      field,
      interval: getSessionsInterval(datetime, {
        highFidelity: organization.features.includes('minute-resolution-sessions'),
      }),
      project: projects[0],
      environment,
      query,
    };

    if (!shouldFetchWithPrevious) {
      return {
        ...baseParams,
        ...normalizeDateTimeParams(datetime),
      };
    }

    const {period} = selection.datetime;
    const doubledPeriod = getPeriod(
      {period, start: undefined, end: undefined},
      {shouldDoublePeriod: true}
    ).statsPeriod;

    return {
      ...baseParams,
      statsPeriod: doubledPeriod,
    };
  }

  const {data, isReloading} = useApiRequests<State>({
    endpoints: [
      ['current', `/organizations/${organization.slug}/sessions/`, {query: queryParams}],
    ],
    onRequestError: () => setErrored(true),
  });
  return <ScoreCard title={title} help={helpText} score="0.45%" />;
}
