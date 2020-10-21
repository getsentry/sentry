import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';
import * as React from 'react';

import {Client} from 'app/api';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import Feature from 'app/components/acl/feature';
import Button from 'app/components/button';
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
  disabled?: boolean;
  organization: Organization;
  payload: DataExportPayload;
  icon?: React.ReactNode;
};

type State = {
  inProgress: boolean;
};

class DataExport extends React.Component<Props, State> {
  state = this.initialState;

  componentDidUpdate({payload: prevPayload}) {
    const {payload} = this.props;
    if (!isEqual(prevPayload, payload)) this.resetState();
  }

  get initialState() {
    return {
      inProgress: false,
    };
  }

  resetState = () => {
    this.setState(this.initialState);
  };

  startDataExport = () => {
    const {
      api,
      organization: {slug},
      payload: {queryType, queryInfo},
    } = this.props;

    this.setState({inProgress: true});

    api
      .requestPromise(`/organizations/${slug}/data-export/`, {
        includeAllArgs: true,
        method: 'POST',
        data: {
          query_type: queryType,
          query_info: queryInfo,
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
        this.setState({inProgress: false});
      });
  };

  render() {
    const {inProgress} = this.state;
    const {children, disabled, icon} = this.props;
    return (
      <Feature features={['organizations:discover-query']}>
        {inProgress ? (
          <Button
            size="small"
            priority="default"
            title="You can get on with your life. We'll email you when your data's ready."
            {...this.props}
            disabled
            icon={icon}
          >
            {t("We're working on it...")}
          </Button>
        ) : (
          <Button
            onClick={debounce(this.startDataExport, 500)}
            disabled={disabled || false}
            size="small"
            priority="default"
            title="Put your data to work. Start your export and we'll email you when it's finished."
            icon={icon}
            {...this.props}
          >
            {children ? children : t('Export All to CSV')}
          </Button>
        )}
      </Feature>
    );
  }
}

export {DataExport};
export default withApi(withOrganization(DataExport));
