import {useCallback} from 'react';

import type {EventQuery} from 'sentry/actionCreators/events';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {ResponseMeta} from 'sentry/types/api';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import type {LocationQuery} from 'sentry/utils/discover/eventView';
import {downloadFromHref} from 'sentry/utils/downloadFromHref';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {createLogDownloadFilename} from 'sentry/views/explore/logs/createLogDownloadFilename';
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

type DiscoverQueryInfo = EventQuery & LocationQuery;

interface ExploreQueryInfo {
  dataset: TraceItemDataset;
  field: string[];
  project: number[];
  query: string;
  sort: string[];
  end?: string;
  environment?: string[];
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

interface UseDataExportOptions {
  inProgressCallback?: (inProgress: boolean) => void;
  unmountedRef?: React.RefObject<boolean>;
}

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

  const filename = createLogDownloadFilename(data.fileName, format);
  downloadFromHref(
    filename,
    `/api/0/organizations/${organizationSlug}/data-export/${data.id}/?download=true`
  );
  addSuccessMessage(t("Downloading '%s' to your browser.", data.fileName));
}

/**
 * @todo(LOGS-698): Modernize this into using a useApiQuery call.
 */
export function useDataExport({
  inProgressCallback,
  unmountedRef,
}: UseDataExportOptions = {}) {
  const organization = useOrganization();
  const api = useApi();

  return useCallback(
    async ({format = 'csv', limit, queryInfo, queryType}: DataExportPayload) => {
      inProgressCallback?.(true);

      const result = await api
        .requestPromise(
          getApiUrl('/organizations/$organizationIdOrSlug/data-export/', {
            path: {organizationIdOrSlug: organization.slug},
          }),
          {
            includeAllArgs: true,
            method: 'POST',
            data: {
              format,
              limit,
              query_info: queryInfo,
              query_type: queryType,
            },
          }
        )
        .then(([data, _, response]) => {
          if (!unmountedRef?.current) {
            handleDataExportResponse(data, format, response, organization.slug);
          }
        })
        .catch(error => {
          // If component has unmounted, don't do anything
          if (unmountedRef?.current) {
            return;
          }
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
          inProgressCallback?.(false);
        });

      return result!;
    },
    [organization.slug, api, inProgressCallback, unmountedRef]
  );
}
