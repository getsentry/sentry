import {useMutation} from '@tanstack/react-query';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {ResponseMeta} from 'sentry/types/api';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {downloadFromHref} from 'sentry/utils/downloadFromHref';
import {QUERY_API_CLIENT} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
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
  limit?: number;
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

export function useDataExport() {
  const organization = useOrganization();

  return useMutation({
    mutationFn: async ({
      format = 'csv',
      limit,
      queryInfo,
      queryType,
    }: DataExportPayload) => {
      const [data, , response] = await QUERY_API_CLIENT.requestPromise(
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
      );

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
