import {Flex} from 'grid-emotion';
import omit from 'lodash/omit';
import PropTypes from 'prop-types';
import React from 'react';

import {Panel, PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {t} from 'app/locale';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import FileSize from 'app/components/fileSize';
import IndicatorStore from 'app/stores/indicatorStore';
import LinkWithConfirmation from 'app/components/links/linkWithConfirmation';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import SentryTypes from 'app/sentryTypes';
import Tooltip from 'app/components/tooltip';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

class ReleaseArtifacts extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    api: PropTypes.object,
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
    const {orgId, projectId, version} = this.props.params;
    const encodedVersion = encodeURIComponent(version);

    return projectId
      ? `/projects/${orgId}/${projectId}/releases/${encodedVersion}/files/`
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
    const loadingIndicator = IndicatorStore.add(t('Removing artifact..'));

    this.props.api.request(this.getFilesEndpoint() + `${id}/`, {
      method: 'DELETE',
      success: () => {
        const fileList = this.state.fileList.filter(file => {
          return file.id !== id;
        });

        this.setState({
          fileList,
        });

        IndicatorStore.add(t('Artifact removed.'), 'success', {
          duration: 4000,
        });
      },
      error: () => {
        IndicatorStore.add(t('Unable to remove artifact. Please try again.'), 'error', {
          duration: 4000,
        });
      },
      complete: () => {
        IndicatorStore.remove(loadingIndicator);
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
            <Flex flex="7" pr={2}>
              {t('Name')}
            </Flex>
            <Flex flex="2">{t('Distribution')}</Flex>
            <Flex flex="3">{t('Size')}</Flex>
          </PanelHeader>
          <PanelBody>
            {this.state.fileList.map(file => {
              return (
                <PanelItem key={file.id}>
                  <Flex
                    flex="7"
                    pr={2}
                    style={{wordWrap: 'break-word', wordBreak: 'break-all'}}
                  >
                    <strong>{file.name || '(empty)'}</strong>
                  </Flex>
                  <Flex flex="2">
                    {file.dist || <span className="text-light">{t('None')}</span>}
                  </Flex>
                  <Flex flex="3" justify="space-between">
                    <FileSize bytes={file.size} />
                    <Flex align="center">
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
                    </Flex>
                  </Flex>
                </PanelItem>
              );
            })}
          </PanelBody>
        </Panel>
        <Pagination pageLinks={this.state.pageLinks} />
      </div>
    );
  }
}

export {ReleaseArtifacts};
export default withOrganization(withApi(ReleaseArtifacts));
