import React from 'react';

import {Client} from 'app/api';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import Feature from 'app/components/acl/feature';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

//! Coordinate with other ExportQueryType (src/sentry/data_export/base.py)
export enum ExportQueryType {
  IssuesByTag = 'Issues-by-Tag',
  Discover = 'Discover',
}

type DataExportPayload = {
  queryType: ExportQueryType;
  queryInfo: any; // TODO(ts): Formalize different possible payloads
};

type Props = {
  api: Client;
  organization: Organization;
  payload: DataExportPayload;
};

type State = {
  inProgress: boolean;
  dataExportId?: number;
};

class DataExport extends React.Component<Props, State> {
  state: State = {
    inProgress: false,
  };

  startDataExport = async () => {
    const {
      api,
      organization: {slug},
      payload: {queryType, queryInfo},
    } = this.props;
    try {
      const {id: dataExportId} = await api.requestPromise(
        `/organizations/${slug}/data-export/`,
        {
          method: 'POST',
          data: {
            query_type: queryType,
            query_info: queryInfo,
          },
        }
      );
      addSuccessMessage(
        t("Sit tight. We'll shoot you an email when your data is ready for download.")
      );
      this.setState({inProgress: true, dataExportId});
    } catch (_err) {
      addErrorMessage(
        t("We tried our hardest, but we couldn't export your data. Give it another go.")
      );
    }
  };

  render() {
    const {inProgress, dataExportId} = this.state;
    return (
      <Feature features={['data-export']}>
        {inProgress && dataExportId ? (
          <Tooltip title="You can get on with your life. We'll email you when your data's ready.">
            <button className="btn btn-default btn-sm" disabled>
              {t("We're working on it...")}
            </button>
          </Tooltip>
        ) : (
          <Tooltip title="Put your data to work. Start your export and we'll email you when it's finished.">
            <button className="btn btn-default btn-sm" onClick={this.startDataExport}>
              {t('Export Data')}
            </button>
          </Tooltip>
        )}
      </Feature>
    );
  }
}

export {DataExport};
export default withApi(withOrganization(DataExport));
