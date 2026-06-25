import {useSessionsRequest} from 'sentry/components/charts/useSessionsRequest';
import type {
  SessionApiResponse,
  SessionFieldWithOperation,
} from 'sentry/types/organization';

type SessionsRequestRenderProps = {
  errored: boolean;
  loading: boolean;
  reloading: boolean;
  response: SessionApiResponse | null;
};

type Props = {
  children: (renderProps: SessionsRequestRenderProps) => React.ReactNode;
  field: SessionFieldWithOperation[];
  end?: string;
  environment?: string[];
  groupBy?: string[];
  interval?: string;
  project?: number[];
  query?: string;
  shouldFilterSessionsInTimeWindow?: boolean;
  start?: string;
  statsPeriod?: string | null;
};

export function SessionsRequest({children, ...requestProps}: Props) {
  const {data: response, isError, isRefetching} = useSessionsRequest(requestProps);

  return children({
    loading: response === null && !isError,
    reloading: response !== null && isRefetching,
    errored: isError,
    response,
  });
}
