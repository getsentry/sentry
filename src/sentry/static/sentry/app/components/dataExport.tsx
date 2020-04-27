import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import React from 'react';

import {Client} from 'app/api';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import Feature from 'app/components/acl/feature';
import Button from 'app/components/button';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import space from 'app/styles/space';
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
};

type State = {
  inProgress: boolean;
  dataExportId?: number;
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
      dataExportId: undefined,
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

    api
      .requestPromise(`/organizations/${slug}/data-export/`, {
        includeAllArgs: true,
        method: 'POST',
        data: {
          query_type: queryType,
          query_info: queryInfo,
        },
      })
      .then(([data, _, response]) => {
        const {id: dataExportId} = data;
        addSuccessMessage(
          response?.status === 201
            ? t(
                "Sit tight. We'll shoot you an email when your data is ready for download."
              )
            : t("It looks like we're already working on it. Sit tight, we'll email you.")
        );
        this.setState({inProgress: true, dataExportId});
      })
      .catch(_err => {
        addErrorMessage(
          t("We tried our hardest, but we couldn't export your data. Give it another go.")
        );
      });
  };

  render() {
    const {inProgress, dataExportId} = this.state;
    const {children, disabled} = this.props;
    return (
      <Feature features={['organizations:data-export']}>
        {inProgress && dataExportId ? (
          <NewButton
            size="small"
            priority="default"
            title="You can get on with your life. We'll email you when your data's ready."
            {...this.props}
            disabled
          >
            {t("We're working on it...")}
          </NewButton>
        ) : (
          <NewButton
            onClick={this.startDataExport}
            disabled={disabled || false}
            size="small"
            priority="default"
            title="Put your data to work. Start your export and we'll email you when it's finished."
            {...this.props}
          >
            {children ? children : t('Export All to CSV')}
          </NewButton>
        )}
      </Feature>
    );
  }
}

const NewButton = ({children, ...buttonProps}) => (
  <Button {...buttonProps}>
    {children}
    <NewTag>{t('NEW')}</NewTag>
  </Button>
);

const NewTag = styled('span')`
  font-size: 9px;
  padding: 3px ${space(1)};
  margin: -3px -3px -3px ${space(0.75)};
  background: ${p => p.theme.green};
  color: ${p => p.theme.white};
  border-radius: 20px;
`;

export {DataExport};
export default withApi(withOrganization(DataExport));
