import React from 'react';
import styled from 'react-emotion';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';

import {t} from 'app/locale';
import LoadingIndicator from 'app/components/loadingIndicator';
import Button from 'app/components/button';
import DateTime from 'app/components/dateTime';
import ErrorBoundary from 'app/components/errorBoundary';
import ExternalLink from 'app/components/links/externalLink';
import EventOrGroupHeader from 'app/components/eventOrGroupHeader';
import EventDataSection from 'app/components/events/eventDataSection';
import EventDevice from 'app/components/events/device';
import EventExtraData from 'app/components/events/extraData';
import EventPackageData from 'app/components/events/packageData';
import FileSize from 'app/components/fileSize';
import NavTabs from 'app/components/navTabs';
import NotFound from 'app/components/errors/notFound';
import withApi from 'app/utils/withApi';
import space from 'app/styles/space';
import getDynamicText from 'app/utils/getDynamicText';
import utils from 'app/utils';

import {INTERFACES} from 'app/components/events/eventEntries';
import TagsTable from './tagsTable';

const OTHER_SECTIONS = {
  context: EventExtraData,
  packages: EventPackageData,
  device: EventDevice,
};

class EventDetails extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    eventSlug: PropTypes.string.isRequired,
  };

  state = {
    loading: true,
    error: false,
    event: null,
    activeTab: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.eventSlug != this.props.eventSlug) {
      this.fetchData();
    }
  }

  async fetchData() {
    this.setState({loading: true, error: false});
    const {orgId} = this.props.params;
    const [projectId, eventId] = this.props.eventSlug.split(':');
    try {
      if (!projectId || !eventId) {
        throw new Error('Invalid eventSlug.');
      }
      const response = await this.props.api.requestPromise(
        `/projects/${orgId}/${projectId}/events/${eventId}/`
      );
      this.setState({
        activeTab: response.entries[0].type,
        event: response,
        loading: false,
      });
    } catch (e) {
      this.setState({error: true});
    }
  }

  handleClose = event => {
    event.preventDefault();

    browserHistory.goBack();
  };

  handleTabChange = tab => this.setState({activeTab: tab});

  renderBody() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    }
    if (this.state.error) {
      return <NotFound />;
    }
    const {event, activeTab} = this.state;
    const jsonUrl = 'TODO build this';

    return (
      <ColumnGrid>
        <ContentColumn>
          <EventOrGroupHeader
            params={this.props.params}
            data={this.state.event}
            includeLink={false}
          />
          <NavTabs underlined={true}>
            {event.entries.map(entry => {
              if (!INTERFACES.hasOwnProperty(entry.type)) {
                return null;
              }
              const type = entry.type;
              const classname = type === activeTab ? 'active' : null;
              return (
                <li key={type} className={classname}>
                  <a
                    href="#"
                    onClick={evt => {
                      evt.preventDefault();
                      this.handleTabChange(type);
                    }}
                  >
                    {utils.toTitleCase(type)}
                  </a>
                </li>
              );
            })}
            {Object.keys(OTHER_SECTIONS).map(section => {
              if (utils.objectIsEmpty(event[section])) {
                return null;
              }
              const classname = section === activeTab ? 'active' : null;
              return (
                <li key={section} className={classname}>
                  <a
                    href="#"
                    onClick={() => {
                      this.handleTabChange(section);
                    }}
                  >
                    {utils.toTitleCase(section)}
                  </a>
                </li>
              );
            })}
          </NavTabs>
          <ErrorBoundary message={t('Could not render event details')}>
            {this.renderActiveTab(event, activeTab)}
          </ErrorBoundary>
        </ContentColumn>
        <SidebarColumn>
          <SidebarBlock withSeparator>
            <h5>ID {event.eventID}</h5>
            <DateTime
              date={getDynamicText({value: event.dateCreated, fixed: 'Dummy timestamp'})}
            />
            <ExternalLink href={jsonUrl} className="json-link">
              JSON (<FileSize bytes={event.size} />)
            </ExternalLink>
          </SidebarBlock>
          <SidebarBlock>
            <TagsTable tags={event.tags} />
          </SidebarBlock>
        </SidebarColumn>
      </ColumnGrid>
    );
  }

  renderActiveTab(event, activeTab) {
    const entry = event.entries.find(item => item.type === activeTab);
    if (INTERFACES[activeTab]) {
      const Component = INTERFACES[activeTab];
      return (
        <Component event={event} type={entry.type} data={entry.data} isShare={false} />
      );
    } else if (OTHER_SECTIONS[activeTab]) {
      const Component = OTHER_SECTIONS[activeTab];
      return <Component event={event} isShare={false} />;
    } else {
      /*eslint no-console:0*/
      window.console &&
        console.error &&
        console.error('Unregistered interface: ' + entry.type);

      return (
        <EventDataSection event={event} type={entry.type} title={entry.type}>
          <p>{t('There was an error rendering this data.')}</p>
        </EventDataSection>
      );
    }
  }

  render() {
    return (
      <ModalContainer>
        <CloseButton onClick={this.handleClose} size="zero" icon="icon-close" />
        {this.renderBody()}
      </ModalContainer>
    );
  }
}

const ColumnGrid = styled('div')`
  display: grid;
  grid-template-columns: 70% 1fr;
  grid-template-rows: auto;
  grid-column-gap: ${space(3)};
`;

const ContentColumn = styled('div')`
  grid-column: 1 / 2;
`;

const SidebarColumn = styled('div')`
  grid-column: 2 / 3;
`;

const SidebarBlock = styled('div')`
  margin: 0 0 ${space(2)} 0;
  padding: ${space(2)} 0;
  ${p => (p.withSeparator ? `border-bottom: 1px solid ${p.theme.borderLight};` : '')}
`;

const ModalContainer = styled('div')`
  position: absolute;
  top: 0px;
  left: 0px;
  right: 0px;
  background: #fff;

  margin: ${space(2)};
  padding: ${space(2)};
  border: 1px solid ${p => p.theme.borderLight};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};

  z-index: ${p => p.theme.zIndex.modal};
`;

const CloseButton = styled(Button)`
  position: absolute;
  top: -10px;
  right: -10px;
  padding: 10px;
  border-radius: 20px;
  box-shadow: ${p => p.theme.dropShadowLight};
`;

export default withApi(EventDetails);
