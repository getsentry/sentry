import React from 'react';
import _ from 'lodash';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/button';
import KeyValueList from 'app/components/events/interfaces/keyValueList';
import LoadingIndicator from 'app/components/loadingIndicator';
import SentryTypes, {EventError} from 'app/sentryTypes';
import space from 'app/styles/space';

const keyMapping = {
  image_uuid: 'Debug ID',
  image_name: 'File Name',
  image_path: 'File Path',
};

const DEBUG_FILE_ERRORS = [
  'native_bad_dsym',
  'native_missing_optionally_bundled_dsym',
  'native_missing_dsym',
  'native_missing_system_dsym',
  'native_missing_symbol',
  'native_simulator_frame',
  'native_unknown_image',
];

const CAN_DOWNLOAD_DEBUG_FILE_ERRORS = ['native_missing_symbol'];

class EventErrorItem extends React.Component {
  static propTypes = {
    error: EventError.isRequired,
    group: SentryTypes.Group.isRequired,
    organization: SentryTypes.Organization.isRequired,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      isOpen: false,
    };
  }

  shouldComponentUpdate(nextProps, nextState) {
    return this.state.isOpen !== nextState.isOpen;
  }

  toggle = () => {
    this.setState({isOpen: !this.state.isOpen});
  };

  cleanedData() {
    const data = {...this.props.error.data};

    // The name is rendered as path in front of the message
    if (typeof data.name === 'string') {
      delete data.name;
    }

    if (data.message === 'None') {
      // Python ensures a message string, but "None" doesn't make sense here
      delete data.message;
    }

    if (typeof data.image_path === 'string') {
      // Separate the image name for readability
      const separator = /^([a-z]:\\|\\\\)/i.test(data.image_path) ? '\\' : '/';
      const path = data.image_path.split(separator);
      data.image_name = path.splice(-1, 1)[0];
      data.image_path = path.length ? path.join(separator) + separator : '';
    }

    return _.mapKeys(data, (value, key) => t(keyMapping[key] || _.startCase(key)));
  }

  renderDebugFileLinks() {
    const {error, group, organization} = this.props;
    const {project} = group;
    const orgId = organization.slug;
    const shouldShowDownload =
      CAN_DOWNLOAD_DEBUG_FILE_ERRORS.includes(error.type) &&
      error.data &&
      error.data.image_uuid;

    return (
      <DebugFileLinks>
        {shouldShowDownload && (
          <Access access={['project:releases']}>
            {({hasAccess}) => (
              <DownloadButton
                disabled={hasAccess}
                orgId={orgId}
                projectId={project.slug}
                debugId={error.data.image_uuid}
              />
            )}
          </Access>
        )}

        <StyledButton
          size="small"
          icon="icon-settings"
          to={`/settings/${orgId}/projects/${project.slug}/debug-symbols/`}
        >
          {t('Go to Debug Files')}
        </StyledButton>
      </DebugFileLinks>
    );
  }

  renderPath() {
    const data = this.props.error.data || {};

    if (!data.name || typeof data.name !== 'string') {
      return null;
    }

    return (
      <React.Fragment>
        <b>{data.name}</b>
        {': '}
      </React.Fragment>
    );
  }

  render() {
    const {error} = this.props;
    const isOpen = this.state.isOpen;
    const data = this.cleanedData();
    const shouldShowDebugFileLinks = DEBUG_FILE_ERRORS.includes(error.type);

    return (
      <li>
        {this.renderPath()}
        {error.message}
        {!_.isEmpty(data) && (
          <small>
            {' '}
            <a style={{marginLeft: 10}} onClick={this.toggle}>
              {isOpen ? t('Collapse') : t('Expand')}
            </a>
          </small>
        )}
        {isOpen && <KeyValueList data={data} isContextData />}
        {isOpen && shouldShowDebugFileLinks && this.renderDebugFileLinks()}
      </li>
    );
  }
}

export default EventErrorItem;

const DebugFileLinks = styled('div')`
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  margin-top: -10px;
`;

const StyledButton = styled(Button)`
  margin-right: ${space(1)};
`;

class DownloadButton extends AsyncComponent {
  getEndpoints() {
    const {orgId, projectId, debugId} = this.props;

    return [
      [
        'debugFiles',
        `/projects/${orgId}/${projectId}/files/dsyms/`,
        {query: {query: debugId}},
      ],
    ];
  }

  renderLoading() {
    return (
      <StyledButton size="small" busy disabled>
        <StyledLoadingIndicator hideMessage mini size="12px" />
        {t('Searching...')}
      </StyledButton>
    );
  }
  renderBody() {
    const {disabled, orgId, projectId} = this.props;
    const {debugFiles} = this.state;
    const isDisabled = disabled || debugFiles.length !== 0;
    const baseUrl = `${this.api.baseUrl}/projects/${orgId}/${projectId}/files/dsyms/`;

    return (
      <StyledButton
        icon="icon-download"
        size="small"
        external
        disabled={isDisabled}
        to={(!isDisabled && `${baseUrl}?id=${debugFiles[0].id}`) || ''}
      >
        {t('Download')}
      </StyledButton>
    );
  }
}

const StyledLoadingIndicator = styled(LoadingIndicator)`
  width: 12px;
  height: 12px;
  &.loading.mini {
    margin: 0 ${space(0.5)};
  }
`;
