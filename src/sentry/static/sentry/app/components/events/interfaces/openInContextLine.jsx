import PropTypes from 'prop-types';
import React from 'react';
import SentryAppIcon from 'app/components/sentryAppIcon';
import {addQueryParamsToExistingUrl} from 'app/utils/queryString';
import {defined} from 'app/utils';
import styled from 'react-emotion';
import space from 'app/styles/space';
import {t} from 'app/locale';

class OpenInContextLine extends React.Component {
  static propTypes = {
    line: PropTypes.array,
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
    const {filename, line, components} = this.props;
    const lineNo = line[0];

    const queryParams = {
      lineNo,
      filename,
    };
    return addQueryParamsToExistingUrl(components[0].schema.url, queryParams);
  }

  render() {
    const {components, line} = this.props;
    const lineNo = line[0];

    let lineWs = '';
    let lineCode = '';
    if (defined(line[1]) && line[1].match) {
      [, lineWs, lineCode] = line[1].match(/^(\s*)(.*?)$/m);
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
            <OpenInIcon slug={components[0].sentryApp.name} />
            <OpenInName>{t(`${components[0].sentryApp.name}`)}</OpenInName>
          </OpenInLink>
        </OpenInContainer>
      </ActiveListItem>
    );
  }
}

export default OpenInContextLine;

const OpenInContainer = styled('div')`
  font-family: 'Rubik', 'Avenir Next', 'Helvetica Neue', sans-serif;
  font-size: 13px;
  padding: 3px;
  border-bottom: 1px solid ${p => p.theme.borderLight};
  background-color: white;
  color: ${p => p.theme.purple2};
  box-shadow: 0 1px 0 0 rgba(0, 0, 0, 0.05);
`;

const OpenInIcon = styled(SentryAppIcon)`
  vertical-align: text-top;
  height: 16px;
  width: 16px;
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

const ListItem = styled('li')`
  padding: 0 20px;
  background: inherit;
`;

const ActiveListItem = styled(ListItem)`
  padding: 0;
  text-indent: 20px;
  z-index: 9999;
`;

const Context = styled('div')`
  display: inline;
`;
