import {useCallback, useEffect, useState} from 'react';
import debounce from 'lodash/debounce';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import Feature from 'sentry/components/acl/feature';
import Button from 'sentry/components/button';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import withApi from 'sentry/utils/withApi';
import withOrganization from 'sentry/utils/withOrganization';

// NOTE: Coordinate with other ExportQueryType (src/sentry/data_export/base.py)
export enum ExportQueryType {
  IssuesByTag = 'Issues-by-Tag',
  Discover = 'Discover',
}

interface DataExportPayload {
  queryInfo: any;
  queryType: ExportQueryType; // TODO(ts): Formalize different possible payloads
}

interface DataExportProps {
  api: Client;
  organization: Organization;
  payload: DataExportPayload;
  children?: React.ReactNode;
  disabled?: boolean;
  icon?: React.ReactNode;
}

function DataExport({
  api,
  children,
  disabled,
  organization,
  payload,
  icon,
}: DataExportProps): React.ReactElement {
  const [inProgress, setInProgress] = useState(false);

  useEffect(() => {
    if (inProgress) {
      setInProgress(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload.queryType, payload.queryInfo]);

  const handleDataExport = useCallback(() => {
    setInProgress(true);

    api
      .requestPromise(`/organizations/${organization.slug}/data-export/`, {
        includeAllArgs: true,
        method: 'POST',
        data: {
          query_type: payload.queryType,
          query_info: payload.queryInfo,
        },
      })
      .then(([_data, _, response]) => {
        addSuccessMessage(
          response?.status === 201
            ? t(
                "Sit tight. We'll shoot you an email when your data is ready for download."
              )
            : t("It looks like we're already working on it. Sit tight, we'll email you.")
        );
      })
      .catch(err => {
        const message =
          err?.responseJSON?.detail ??
          "We tried our hardest, but we couldn't export your data. Give it another go.";

        addErrorMessage(t(message));
        setInProgress(false);
      });
  }, [payload.queryInfo, payload.queryType, organization.slug, api]);

  return (
    <Feature features={['organizations:discover-query']}>
      {inProgress ? (
        <Button
          size="sm"
          priority="default"
          title="You can get on with your life. We'll email you when your data's ready."
          disabled
          icon={icon}
        >
          {t("We're working on it...")}
        </Button>
      ) : (
        <Button
          onClick={debounce(handleDataExport, 500)}
          disabled={disabled || false}
          size="sm"
          priority="default"
          title="Put your data to work. Start your export and we'll email you when it's finished."
          icon={icon}
        >
          {children ? children : t('Export All to CSV')}
        </Button>
      )}
    </Feature>
  );
}

export {DataExport};
export default withApi(withOrganization(DataExport));
