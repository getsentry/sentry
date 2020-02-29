import React from 'react';
import PropTypes from 'prop-types';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';

import ColumnEditCollection from 'app/views/eventsV2/table/columnEditCollection';

/**
 * Fake modal container. Later on this will be a stateful
 * container that will update the EventView column edits
 * are submitted.
 */
class FakeModal extends React.Component {
  static propTypes = {
    organization: PropTypes.object,
    tagKeys: PropTypes.arrayOf(PropTypes.string),
  };

  state = {
    columns: [
      {
        field: 'event.type',
      },
      {
        field: 'browser.name',
      },
      {
        field: 'id',
        aggregation: 'count',
      },
    ],
  };

  handleChange = columns => {
    this.setState({columns});
  };

  render() {
    const {tagKeys, organization} = this.props;
    return (
      <ColumnEditCollection
        organization={organization}
        columns={this.state.columns}
        tagKeys={tagKeys}
        onChange={this.handleChange}
      />
    );
  }
}

storiesOf('Discover|ColumnEditor', module).add(
  'all',
  withInfo({
    text: 'Playground for building out column editor v2 for discover',
  })(() => {
    const organization = {
      slug: 'test-org',
      features: ['transaction-events'],
    };
    const tags = ['browser.name', 'custom-field'];

    return (
      <div>
        <FakeModal organization={organization} tagKeys={tags} />
      </div>
    );
  })
);
