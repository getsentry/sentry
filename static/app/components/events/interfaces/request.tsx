import {Component} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import EventDataSection from 'sentry/components/events/eventDataSection';
import RichHttpContent from 'sentry/components/events/interfaces/richHttpContent/richHttpContent';
import {getCurlCommand, getFullUrl} from 'sentry/components/events/interfaces/utils';
import ExternalLink from 'sentry/components/links/externalLink';
import Truncate from 'sentry/components/truncate';
import {IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {EntryRequest, Event} from 'sentry/types/event';
import {isUrl} from 'sentry/utils';

type Props = {
  data: EntryRequest['data'];
  event: Event;
  type: string;
};

type State = {
  view: string;
};

class RequestInterface extends Component<Props, State> {
  state: State = {
    view: 'formatted',
  };

  isPartial = () =>
    // We assume we only have a partial interface is we're missing
    // an HTTP method. This means we don't have enough information
    // to reliably construct a full HTTP request.
    !this.props.data.method || !this.props.data.url;

  toggleView = (value: string) => {
    this.setState({
      view: value,
    });
  };

  render() {
    const {data, type} = this.props;
    const view = this.state.view;

    let fullUrl = getFullUrl(data);
    if (!isUrl(fullUrl)) {
      // Check if the url passed in is a safe url to avoid XSS
      fullUrl = undefined;
    }

    let parsedUrl: HTMLAnchorElement | null = null;
    if (fullUrl) {
      // use html tag to parse url, lol
      parsedUrl = document.createElement('a');
      parsedUrl.href = fullUrl;
    }

    let actions: React.ReactNode = null;
    if (!this.isPartial() && fullUrl) {
      actions = (
        <ButtonBar merged active={view}>
          <Button
            barId="formatted"
            size="xs"
            onClick={this.toggleView.bind(this, 'formatted')}
          >
            {/* Translators: this means "formatted" rendering (fancy tables) */}
            {t('Formatted')}
          </Button>
          <MonoButton barId="curl" size="xs" onClick={this.toggleView.bind(this, 'curl')}>
            curl
          </MonoButton>
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

const MonoButton = styled(Button)`
  font-family: ${p => p.theme.text.familyMono};
`;

const Path = styled('span')`
  color: ${p => p.theme.textColor};
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
  color: ${p => p.theme.subText};
  position: relative;
  top: 1px;

  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

export default RequestInterface;
