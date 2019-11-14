import PropTypes from 'prop-types';
import React from 'react';
import SentryAppIcon from 'app/components/sentryAppIcon';
import {addQueryParamsToExistingUrl} from 'app/utils/queryString';
import styled from 'react-emotion';
import space from 'app/styles/space';
import {t} from 'app/locale';
import {recordInteraction} from 'app/utils/recordSentryAppInteraction';

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

  getUrl(component) {
    const {filename, lineNo} = this.props;

    const queryParams = {
      lineNo,
      filename,
    };
    return addQueryParamsToExistingUrl(component.schema.url, queryParams);
  }

  renderOpenInLink = component => {
    const url = this.getUrl(component);
    const {slug} = component.sentryApp;

    const recordStacktraceLinkInteraction = () => {
      recordInteraction(slug, 'sentry_app_component_interacted', {
        componentType: 'stacktrace-link',
      });
    };

    return (
      <OpenInLink
        key={component.uuid}
        data-test-id={`stacktrace-link-${slug}`}
        href={url}
        onClick={recordStacktraceLinkInteraction}
        onContextMenu={recordStacktraceLinkInteraction}
      >
        <OpenInIcon slug={slug} />
        <OpenInName>{t(`${component.sentryApp.name}`)}</OpenInName>
      </OpenInLink>
    );
  };

  render() {
    const {components} = this.props;
    return (
      <OpenInContainer>
        <span>{t('Open this line in:')}</span>
        {components.map(this.renderOpenInLink)}
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
  overflow: auto;
  white-space: nowrap;
`;

const OpenInIcon = styled(SentryAppIcon)`
  vertical-align: text-top;
  height: 15px;
  width: 15px;
  margin-left: ${space(1)};
  margin-right: 4px;
`;

const OpenInLink = styled('a')`
  color: ${p => p.theme.gray2};
  cursor: pointer;
  margin-left: 5px;
  &:not(:last-child):after {
    border-right: 1px solid ${p => p.theme.gray1};
    content: '';
    height: 60%;
    margin-top: 15%;
    margin-left: 10px;
  }
`;

const OpenInName = styled('span')`
  font-weight: bold;
  color: ${p => p.theme.gray3};
`;
