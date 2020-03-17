import PropTypes from 'prop-types';
import React from 'react';
import omit from 'lodash/omit';
import styled from '@emotion/styled';

import {Panel, PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import FileSize from 'app/components/fileSize';
import LinkWithConfirmation from 'app/components/links/linkWithConfirmation';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import SentryTypes from 'app/sentryTypes';
import Tooltip from 'app/components/tooltip';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import space from 'app/styles/space';

class ReleaseArtifacts extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    api: PropTypes.object,
    projectId: PropTypes.string,
  };

  constructor() {
    super();
    this.state = {
      loading: true,
      error: false,
      fileList: [],
      pageLinks: null,
    };
  }

  componentDidMount() {
    this.fetchData();
  }

  getFilesEndpoint() {
    // ?? to temporarily support releases V1 and V2
    const {orgId, projectId, version, release} = this.props.params;
    const encodedVersion = encodeURIComponent(version ?? release);
    const project = projectId ?? this.props.projectId;

    return project
      ? `/projects/${orgId}/${project}/releases/${encodedVersion}/files/`
      : `/organizations/${orgId}/releases/${encodedVersion}/files/`;
  }

  fetchData = () => {
    this.setState({
      loading: true,
      error: false,
    });

    this.props.api.request(this.getFilesEndpoint(), {
      method: 'GET',
      // We need to omit global selection header url params because they are not supported
      data: omit(this.props.location.query, Object.values(URL_PARAM)),
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          fileList: data,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  };

  handleRemove(id) {
    addLoadingMessage(t('Removing artifact..'));

    this.props.api.request(this.getFilesEndpoint() + `${id}/`, {
      method: 'DELETE',
      success: () => {
        const fileList = this.state.fileList.filter(file => file.id !== id);

        this.setState({
          fileList,
        });

        addSuccessMessage(t('Artifact removed.'));
      },
      error: () => {
        addErrorMessage(t('Unable to remove artifact. Please try again.'));
      },
    });
  }

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    } else if (this.state.fileList.length === 0) {
      return (
        <Panel>
          <EmptyStateWarning>
            <p>{t('There are no artifacts uploaded for this release.')}</p>
          </EmptyStateWarning>
        </Panel>
      );
    }

    const access = new Set(this.props.organization.access);

    // TODO(dcramer): files should allow you to download them
    return (
      <div>
        <Panel>
          <PanelHeader>
            <NameColumn>{t('Name')}</NameColumn>
            <DistributionColumn>{t('Distribution')}</DistributionColumn>
            <SizeAndActionsColumn>{t('Size')}</SizeAndActionsColumn>
          </PanelHeader>
          <PanelBody>
            {this.state.fileList.map(file => (
              <PanelItem key={file.id}>
                <NameColumn>
                  <strong>{file.name || '(empty)'}</strong>
                </NameColumn>
                <DistributionColumn>
                  {file.dist || <span className="text-light">{t('None')}</span>}
                </DistributionColumn>
                <SizeAndActionsColumn>
                  <FileSize bytes={file.size} />
                  <AlignCenter>
                    {access.has('project:write') ? (
                      <a
                        href={
                          this.props.api.baseUrl +
                          this.getFilesEndpoint() +
                          `${file.id}/?download=1`
                        }
                        className="btn btn-sm btn-default"
                      >
                        <span className="icon icon-open" />
                      </a>
                    ) : (
                      <Tooltip
                        title={t(
                          'You do not have the required permission to download this artifact.'
                        )}
                      >
                        <div className="btn btn-sm btn-default disabled">
                          <span className="icon icon-open" />
                        </div>
                      </Tooltip>
                    )}
                    <div style={{marginLeft: 5}}>
                      <LinkWithConfirmation
                        className="btn btn-sm btn-default"
                        title={t('Delete artifact')}
                        message={t('Are you sure you want to remove this artifact?')}
                        onConfirm={this.handleRemove.bind(this, file.id)}
                      >
                        <span className="icon icon-trash" />
                      </LinkWithConfirmation>
                    </div>
                  </AlignCenter>
                </SizeAndActionsColumn>
              </PanelItem>
            ))}
          </PanelBody>
        </Panel>
        <Pagination pageLinks={this.state.pageLinks} />
      </div>
    );
  }
}

const NameColumn = styled('div')`
  display: flex;
  flex: 7;
  padding-right: ${space(2)};
  word-wrap: break-word;
  word-break: break-all;
`;
const DistributionColumn = styled('div')`
  display: flex;
  flex: 2;
  padding-right: ${space(2)};
`;
const SizeAndActionsColumn = styled('div')`
  display: flex;
  flex: 3;
  justify-content: space-between;
`;
const AlignCenter = styled('div')`
  display: flex;
  align-items: center;
`;

export {ReleaseArtifacts};
export default withOrganization(withApi(ReleaseArtifacts));
