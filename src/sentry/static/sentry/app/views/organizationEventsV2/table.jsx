import React from 'react';
import PropTypes from 'prop-types';
import {css} from 'react-emotion';

import withApi from 'app/utils/withApi';
import SentryTypes from 'app/sentryTypes';
import {Panel, PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import LoadingIndicator from 'app/components/loadingIndicator';

import {fetchOrganizationEvents} from './utils';

class Table extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    organization: SentryTypes.Organization.isRequired,
    view: SentryTypes.EventView.isRequired,
  };

  constructor(props) {
    super(props);
    this.state = {events: [], isLoading: true, hasError: false};
  }

  componentDidMount() {
    this.fetchData();
  }

  fetchData = async () => {
    const {api, organization} = this.props;
    this.setState({isLoading: true, hasError: false});
    try {
      const events = await fetchOrganizationEvents(api, organization.slug);
      this.setState({
        events,
        isLoading: false,
      });
    } catch (e) {
      this.setState({isLoading: false, hasError: true});
    }
  };

  renderBody() {
    const {events, isLoading} = this.state;
    const {fields} = this.props.view.data;

    if (isLoading) {
      return <LoadingIndicator />;
    }

    return events.map(event => (
      <PanelItem key={event.id} className={getGridStyle(fields.length)}>
        {fields.map(field => (
          <div key={field}>{event[field]}</div>
        ))}
      </PanelItem>
    ));
  }

  render() {
    const {fields} = this.props.view.data;

    return (
      <Panel>
        <PanelHeader className={getGridStyle(fields.length)}>
          {fields.map(field => (
            <div key={field}>{field}</div>
          ))}
        </PanelHeader>
        <PanelBody>{this.renderBody()}</PanelBody>
      </Panel>
    );
  }
}

export default withApi(Table);

function getGridStyle(colCount) {
  return css`
    display: grid;
    grid-template-columns: 2fr repeat(${colCount - 1}, 1fr);
  `;
}
