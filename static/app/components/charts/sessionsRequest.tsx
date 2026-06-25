import type {Client} from 'sentry/api';
import {useSessionsRequest} from 'sentry/components/charts/useSessionsRequest';
import type {
  Organization,
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
  api: Client;
  children: (renderProps: SessionsRequestRenderProps) => React.ReactNode;
  field: SessionFieldWithOperation[];
  organization: Organization;
  end?: string;
  environment?: string[];
  groupBy?: string[];
  interval?: string;
  isDisabled?: boolean;
  project?: number[];
  query?: string;
  shouldFilterSessionsInTimeWindow?: boolean;
  start?: string;
  statsPeriod?: string | null;
};

export function SessionsRequest({
  children,
  // `api` and `organization` are no longer needed: the request is made via the
  // `useSessionsRequest` hook (which resolves the organization from context and
  // uses the query client). They remain in the props for backwards
  // compatibility with existing callers.
  api: _api,
  organization: _organization,
  ...requestProps
}: Props) {
  const {
    data: response,
    isError,
    isRefetching,
  } = useSessionsRequest(requestProps);

  return children({
    loading: response === null,
    reloading: response !== null && isRefetching,
    errored: isError,
    response,
  });
}
