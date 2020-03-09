import React from 'react';

import {Client} from 'app/api';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import Feature from 'app/components/acl/feature';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

type DataExportPayload = {
  // Coordinate with ExportQueryType string (src/sentry/constants.py)
  queryType: 'Issues-by-Tag' | 'Discover';
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

const TooltipMessages = {
  start: "We'll get all your data in one place and email you when it's ready",
  progress: "We'll email you when it's ready",
} as const;

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
      addSuccessMessage(t("We'll email you when it's ready for download"));
      this.setState({inProgress: true, dataExportId});
    } catch (_err) {
      addErrorMessage(t('Unable to begin bulk data export. Please try again.'));
    }
  };

  render() {
    const {inProgress, dataExportId} = this.state;
    return (
      <Feature features={['data-export']}>
        {inProgress && dataExportId ? (
          <Tooltip title={TooltipMessages.progress}>
            <button className="btn btn-default btn-sm" disabled>
              {t('Queued up!')}
            </button>
          </Tooltip>
        ) : (
          <Tooltip title={TooltipMessages.start}>
            <button className="btn btn-default btn-sm" onClick={this.startDataExport}>
              {t('Export All to CSV')}
            </button>
          </Tooltip>
        )}
      </Feature>
    );
  }
}

export {DataExport};
export default withApi(withOrganization(DataExport));
