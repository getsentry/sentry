import PropTypes from 'prop-types';
import React from 'react';
import SentryTypes from 'app/sentryTypes';
import InlineSvg from 'app/components/inlineSvg';
import {addQueryParamsToExistingUrl} from 'app/utils/queryString';
import styled from 'react-emotion';
import {t} from 'app/locale';

import withApi from 'app/utils/withApi';
import withLatestContext from 'app/utils/withLatestContext';

class OpenInButton extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    organization: SentryTypes.Organization,
    lineNo: PropTypes.number,
    lineWs: PropTypes.string,
    lineCode: PropTypes.string,
    filename: PropTypes.string,
    group: SentryTypes.Group,
  };

  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      error: false,
      components: [],
    };
  }

  componentWillMount() {
    this.fetchIssueLinkComponents();
  }

  fetchIssueLinkComponents() {
    const {api, organization, group} = this.props;
    const hasOrganization = !!organization;
    const hasSentryApps =
      hasOrganization && new Set(organization.features).has('sentry-apps');

    if (hasSentryApps && group && group.project && group.project.id) {
      api
        .requestPromise(
          `/organizations/${
            organization.slug
          }/sentry-app-components/?filter=stacktrace-link&projectId=${group.project.id}`
        )
        .then(data => {
          if (data.length) {
            this.setState({components: data});
          }
        })
        .catch(error => {
          return;
        });
    }
  }

  getUrl() {
    const {components} = this.state;
    const {filename, lineNo} = this.props;

    const queryParams = {
      lineNo,
      filename,
    };
    return addQueryParamsToExistingUrl(components[0].schema.url, queryParams);
  }

  render() {
    const {components} = this.state;
    const {lineNo, lineWs, lineCode} = this.props;

    if (!components.length) {
      return (
        <ListItem className="expandable active" key={lineNo}>
          <span className="ws">{lineWs}</span>
          <span className="contextline">{lineCode}</span>
        </ListItem>
      );
    }
    const url = this.getUrl();
    return (
      <ActiveListItem className="expandable active" key={lineNo}>
        <Context>
          <span className="ws">{lineWs}</span>
          <span className="contextline">{lineCode}</span>
        </Context>
        <OpenInContainer>
          <span>Open this line in:</span>
          <OpenInLink data-test-id="stacktrace-link" href={url}>
            <OpenInIcon src="icon-generic-box" />
            <OpenInName>{t(`${components[0].sentryApp.name}`)}</OpenInName>
          </OpenInLink>
        </OpenInContainer>
      </ActiveListItem>
    );
  }
}

export {OpenInButton};
const OpenInButtonComponent = withLatestContext(OpenInButton);
export default withApi(OpenInButtonComponent);

const OpenInContainer = styled('div')`
  font-family: 'Rubik', 'Avenir Next', 'Helvetica Neue', sans-serif;
  font-size: 13px;
  padding: 3px;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  background-color: white;
  color: ${p => p.theme.purple2};
`;

const OpenInIcon = styled(InlineSvg)`
  vertical-align: text-top;
  height: 14px;
  width: 14px;
  margin-left: 2px;
`;

const OpenInLink = styled('a')`
  padding-left: 5px;
  cursor: pointer;
`;

const OpenInName = styled('span')`
  font-weight: bold;
  color: ${p => p.theme.gray3};
  margin-left: 2px;
`;

const ListItem = styled('li')`
  padding: 0 20px;
  background: inherit;
`;

const ActiveListItem = styled(ListItem)`
  padding: 0;
  text-indent: 20px;
`;

const Context = styled('div')`
  display: inline;
`;
