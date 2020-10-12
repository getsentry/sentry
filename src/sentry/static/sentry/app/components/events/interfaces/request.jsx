import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import EventDataSection from 'app/components/events/eventDataSection';
import SentryTypes from 'app/sentryTypes';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import RichHttpContent from 'app/components/events/interfaces/richHttpContent/richHttpContent';
import {getFullUrl, getCurlCommand} from 'app/components/events/interfaces/utils';
import {isUrl} from 'app/utils';
import {t} from 'app/locale';
import ExternalLink from 'app/components/links/externalLink';
import {IconOpen} from 'app/icons';
import space from 'app/styles/space';
import Truncate from 'app/components/truncate';

class RequestInterface extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
    type: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
  };

  static contextTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      view: 'formatted',
    };
  }

  isPartial = () =>
    // We assume we only have a partial interface is we're missing
    // an HTTP method. This means we don't have enough information
    // to reliably construct a full HTTP request.
    !this.props.data.method || !this.props.data.url;

  toggleView = value => {
    this.setState({
      view: value,
    });
  };

  render() {
    const {event, data, type} = this.props;
    const view = this.state.view;

    let fullUrl = getFullUrl(data);
    if (!isUrl(fullUrl)) {
      // Check if the url passed in is a safe url to avoid XSS
      fullUrl = null;
    }

    let parsedUrl = null;
    if (fullUrl) {
      // use html tag to parse url, lol
      parsedUrl = document.createElement('a');
      parsedUrl.href = fullUrl;
    }

    let actions;
    if (!this.isPartial() && fullUrl) {
      actions = (
        <ButtonBar merged active={view}>
          <Button
            barId="formatted"
            size="xsmall"
            onClick={this.toggleView.bind(this, 'formatted')}
          >
            {/* Translators: this means "formatted" rendering (fancy tables) */}
            {t('Formatted')}
          </Button>
          <Button
            data-test-id="curl"
            barId="curl"
            size="xsmall"
            onClick={this.toggleView.bind(this, 'curl')}
          >
            curl
          </Button>
        </ButtonBar>
      );
    }

    const title = (
      <Header key="title">
        <ExternalLink href={fullUrl} title={fullUrl}>
          <Path>
            <strong>{data.method || 'GET'}</strong>
            <Truncate
              value={parsedUrl ? parsedUrl.pathname : ''}
              maxLength={36}
              leftTrim
            />
          </Path>
          {fullUrl && <StyledIconOpen size="xs" />}
        </ExternalLink>
        <small>{parsedUrl ? parsedUrl.hostname : ''}</small>
      </Header>
    );

    return (
      <EventDataSection
        event={event}
        type={type}
        title={title}
        actions={actions}
        wrapTitle={false}
        className="request"
      >
        {view === 'curl' ? (
          <pre>{getCurlCommand(data)}</pre>
        ) : (
          <RichHttpContent data={data} />
        )}
      </EventDataSection>
    );
  }
}

const Path = styled('span')`
  color: ${p => p.theme.gray700};
  text-transform: none;
  font-weight: normal;

  & strong {
    margin-right: ${space(0.5)};
  }
`;

const Header = styled('h3')`
  display: flex;
  align-items: center;
`;

// Nudge the icon down so it is centered. the `external-icon` class
// doesn't quite get it in place.
const StyledIconOpen = styled(IconOpen)`
  transition: 0.1s linear color;
  margin: 0 ${space(0.5)};
  color: ${p => p.theme.gray400};
  position: relative;
  top: 1px;

  &:hover {
    color: ${p => p.theme.gray600};
  }
`;

export default RequestInterface;
