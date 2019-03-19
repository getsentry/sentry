import PropTypes from 'prop-types';
import React from 'react';
import SentryTypes from 'app/sentryTypes';
import Button from 'app/components/button';
import qs from 'query-string';
import styled from 'react-emotion';
import {t} from 'app/locale';

import withApi from 'app/utils/withApi';
import withLatestContext from 'app/utils/withLatestContext';

class OpenInButton extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    lineNo: PropTypes.number,
    filename: PropTypes.string,
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
    const {api, organization, project} = this.props;
    api
      .requestPromise(
        `/organizations/${organization.slug}/sentry-app-components/?filter=stacktrace-link&projectId=${project.id}`
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

  getUrl() {
    const {components} = this.state;
    const {filename, lineNo} = this.props;

    const queryParams = {
      lineNo,
      filename,
    };
    const query = qs.stringify(queryParams);
    return components[0].schema.url + '&' + query;
  }

  render() {
    const {components} = this.state;
    if (!components.length) {
      return null;
    }

    const url = this.getUrl();
    return (
      <StyledButtonContainer>
        <StyledButton href={url} size="small" priority="primary">
          {t(`Debug In ${components[0].sentryApp.name}`)}
        </StyledButton>
      </StyledButtonContainer>
    );
  }
}

export {OpenInButton};
const OpenInButtonComponent = withLatestContext(OpenInButton);
export default withApi(OpenInButtonComponent);

const StyledButtonContainer = styled('div')`
  height: 0;
  position: relative;
`;

const StyledButton = styled(Button)`
  position: absolute;
  z-index: ${p => p.theme.zIndex.header};
  height: 36px;
  line-height: 1.5;
  padding: 0px 5px;
  top: -31px;
  right: 30px;
`;
