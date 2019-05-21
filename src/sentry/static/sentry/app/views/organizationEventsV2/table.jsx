import React from 'react';
import PropTypes from 'prop-types';
import styled, {css} from 'react-emotion';

import withApi from 'app/utils/withApi';
import SentryTypes from 'app/sentryTypes';
import {Panel, PanelHeader, PanelBody, PanelItem} from 'app/components/panels';
import LoadingIndicator from 'app/components/loadingIndicator';
import overflowEllipsis from 'app/styles/overflowEllipsis';

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
    const {api, organization, view} = this.props;
    this.setState({isLoading: true, hasError: false});
    try {
      const events = await fetchOrganizationEvents(api, organization.slug, view);
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
      <Row key={event.id} className={getGridStyle(fields.length)}>
        {fields.map(field => (
          <Cell key={field}>
            <Data>{event[field]}</Data>
          </Cell>
        ))}
      </Row>
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
    grid-template-columns: 3fr repeat(${colCount - 1}, 1fr);
  `;
}

const Row = styled(PanelItem)`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Cell = styled('div')`
  overflow: hidden;
`;

const Data = styled('div')`
  ${overflowEllipsis}
`;
