import {useCallback} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ResponseMeta} from 'sentry/api';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {downloadFromHref} from 'sentry/utils/downloadFromHref';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {createLogDownloadFilename} from 'sentry/views/explore/logs/createLogDownloadFilename';

// NOTE: Coordinate with other ExportQueryType (src/sentry/data_export/base.py)
export enum ExportQueryType {
  ISSUES_BY_TAG = 'Issues-by-Tag',
  DISCOVER = 'Discover',
  EXPLORE = 'Explore',
  TRACE_ITEM_FULL_EXPORT = 'trace_item_full_export',
}

// NOTE: Coordinate with data_export's OutputMode (src/sentry/data_export/writers.py)
export type DataExportFormat = 'csv' | 'jsonl';

export interface DataExportPayload {
  /**
   * TODO(LOGS-702): Formalize different possible payloads
   */
  queryInfo: any;
  queryType: ExportQueryType;

  format?: DataExportFormat;
}

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
    async ({format = 'csv', queryInfo, queryType}: DataExportPayload) => {
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
          const message =
            error?.responseJSON?.detail ??
            t(
              "We tried our hardest, but we couldn't export your data. Give it another go."
            );

          addErrorMessage(message);
          inProgressCallback?.(false);
        });

      return result!;
    },
    [organization.slug, api, inProgressCallback, unmountedRef]
  );
}
