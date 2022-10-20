import {useCallback, useEffect, useRef, useState} from 'react';
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
  const unmountedRef = useRef(false);
  const [inProgress, setInProgress] = useState(false);

  // We clear the indicator if export props change so that the user
  // can fire another export without having to wait for the previous one to finish.
  useEffect(() => {
    if (inProgress) {
      setInProgress(false);
    }
    // We are skipping the inProgress dependency because it would have fired on each handleDataExport
    // call and would have immediately turned off the value giving users no feedback on their click action.
    // An alternative way to handle this would have probably been to key the component by payload/queryType,
    // but that seems like it can be a complex object so tracking changes could result in very brittle behavior.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload.queryType, payload.queryInfo]);

  // Tracking unmounting of the component to prevent setState call on unmounted component
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
    };
  }, []);

  const handleDataExport = useCallback(() => {
    setInProgress(true);

    // This is a fire and forget request.
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
        // If component has unmounted, don't do anything
        if (unmountedRef.current) {
          return;
        }

        addSuccessMessage(
          response?.status === 201
            ? t(
                "Sit tight. We'll shoot you an email when your data is ready for download."
              )
            : t("It looks like we're already working on it. Sit tight, we'll email you.")
        );
      })
      .catch(err => {
        // If component has unmounted, don't do anything
        if (unmountedRef.current) {
          return;
        }
        const message =
          err?.responseJSON?.detail ??
          t(
            "We tried our hardest, but we couldn't export your data. Give it another go."
          );

        addErrorMessage(message);
        setInProgress(false);
      });
  }, [payload.queryInfo, payload.queryType, organization.slug, api]);

  return (
    <Feature features={['organizations:discover-query']}>
      {inProgress ? (
        <Button
          size="sm"
          priority="default"
          title={t(
            "You can get on with your life. We'll email you when your data's ready."
          )}
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
          title={t(
            "Put your data to work. Start your export and we'll email you when it's finished."
          )}
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
