import {useMutation} from '@tanstack/react-query';

import type {EventQuery} from 'sentry/actionCreators/events';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {createExportFilename} from 'sentry/components/exports/createExportFilename';
import {t} from 'sentry/locale';
import type {ApiResult, ResponseMeta} from 'sentry/types/api';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {LocationQuery} from 'sentry/utils/discover/eventView';
import {downloadFromHref} from 'sentry/utils/downloadFromHref';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {TraceItemDataset} from 'sentry/views/explore/types';

// NOTE: Coordinate with other ExportQueryType (src/sentry/data_export/base.py)
export enum ExportQueryType {
  ISSUES_BY_TAG = 'Issues-by-Tag',
  DISCOVER = 'Discover',
  EXPLORE = 'Explore',
  TRACE_ITEM_FULL_EXPORT = 'trace_item_full_export',
}

// NOTE: Coordinate with data_export's OutputMode (src/sentry/data_export/writers.py)
export type DataExportFormat = 'csv' | 'jsonl';

interface IssuesByTagQueryInfo {
  group: number | string;
  key: string;
  project: number | string;
}

export type DiscoverQueryInfo = EventQuery & LocationQuery;

type EventsQuerySamplingMode =
  | 'NORMAL'
  | 'HIGHEST_ACCURACY'
  | 'HIGHEST_ACCURACY_FLEX_TIME';

export interface ExploreQueryInfo {
  dataset: TraceItemDataset;
  field: string[];
  project: number[];
  query: string;
  sort: string[];
  end?: string;
  environment?: string[];
  sampling?: EventsQuerySamplingMode;
  start?: string;
  statsPeriod?: string;
}

interface DataExportPayloadBase {
  format?: DataExportFormat;
  limit?: number;
}

interface IssuesByTagExportPayload extends DataExportPayloadBase {
  queryInfo: IssuesByTagQueryInfo;
  queryType: ExportQueryType.ISSUES_BY_TAG;
}

interface DiscoverExportPayload extends DataExportPayloadBase {
  queryInfo: DiscoverQueryInfo;
  queryType: ExportQueryType.DISCOVER;
}

interface ExploreExportPayload extends DataExportPayloadBase {
  queryInfo: ExploreQueryInfo;
  queryType: ExportQueryType.EXPLORE | ExportQueryType.TRACE_ITEM_FULL_EXPORT;
}

export type DataExportPayload =
  | IssuesByTagExportPayload
  | DiscoverExportPayload
  | ExploreExportPayload;

interface DataExportData {
  checksum: string | null;
  dateCreated: string;
  dateExpired: string | null;
  dateFinished: string | null;
  fileName: null;
  id: number;
  status: string;
}

function handleDataExportResponse(
  data: DataExportData,
  format: DataExportFormat,
  response: ResponseMeta | undefined,
  organizationSlug: string
) {
  if (response?.status !== 201) {
    addSuccessMessage(
      t("It looks like we're already working on it. Sit tight, we'll email you.")
    );
    return;
  }

  if (!data.fileName) {
    addSuccessMessage(
      t("Sit tight. We'll shoot you an email when your data is ready for download.")
    );
    return;
  }

  const filename = createExportFilename(data.fileName, format);
  downloadFromHref(
    filename,
    `/api/0/organizations/${organizationSlug}/data-export/${data.id}/?download=true`
  );
  addSuccessMessage(t("Downloading '%s' to your browser.", data.fileName));
}

export function useDataExport() {
  const organization = useOrganization();

  return useMutation({
    mutationFn: async ({
      format = 'csv',
      limit,
      queryInfo,
      queryType,
    }: DataExportPayload) => {
      const [data, , response] = await fetchMutation<ApiResult>({
        url: getApiUrl('/organizations/$organizationIdOrSlug/data-export/', {
          path: {organizationIdOrSlug: organization.slug},
        }),
        options: {
          includeAllArgs: true,
        },
        method: 'POST',
        data: {
          format,
          limit,
          query_info: queryInfo,
          query_type: queryType,
        },
      });

      return {data: data as DataExportData, format, response};
    },
    onSuccess: ({data, format, response}) => {
      handleDataExportResponse(data, format, response, organization.slug);
    },
    onError: error => {
      if (
        error instanceof RequestError &&
        typeof error.responseJSON?.detail === 'string'
      ) {
        addErrorMessage(error.responseJSON.detail);
      } else {
        addErrorMessage(
          t(
            "We tried our hardest, but we couldn't export your data. Try waiting a minute then giving it another go."
          )
        );
      }
    },
  });
}
