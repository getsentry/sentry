import PropTypes from 'prop-types';
import React from 'react';
import SentryAppIcon from 'app/components/sentryAppIcon';
import {addQueryParamsToExistingUrl} from 'app/utils/queryString';
import styled from 'react-emotion';
import space from 'app/styles/space';
import {t} from 'app/locale';

class OpenInContextLine extends React.Component {
  static propTypes = {
    lineNo: PropTypes.number,
    filename: PropTypes.string,
    components: PropTypes.array,
  };

  constructor(props) {
    super(props);
    this.state = {
      loading: false,
      error: false,
    };
  }

  getUrl() {
    const {filename, lineNo, components} = this.props;

    const queryParams = {
      lineNo,
      filename,
    };
    return addQueryParamsToExistingUrl(components[0].schema.url, queryParams);
  }

  render() {
    const {components} = this.props;
    const url = this.getUrl();
    return (
      <OpenInContainer>
        <span>{t('Open this line in:')}</span>
        <OpenInLink data-test-id="stacktrace-link" href={url}>
          <OpenInIcon slug={components[0].sentryApp.slug} />
          <OpenInName>{t(`${components[0].sentryApp.name}`)}</OpenInName>
        </OpenInLink>
      </OpenInContainer>
    );
  }
}

export default OpenInContextLine;

const OpenInContainer = styled('div')`
  font-family: ${p => p.theme.text.family};
  font-size: 13px;
  padding: 3px;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  background-color: white;
  color: ${p => p.theme.purple2};
  box-shadow: 0 1px 0 0 rgba(0, 0, 0, 0.05);
`;

const OpenInIcon = styled(SentryAppIcon)`
  vertical-align: text-top;
  height: 15px;
  width: 15px;
  margin-left: ${space(1)};
`;

const OpenInLink = styled('a')`
  color: ${p => p.theme.gray2};
  cursor: pointer;
`;

const OpenInName = styled('span')`
  font-weight: bold;
  color: ${p => p.theme.gray3};
  margin-left: 5px;
`;
