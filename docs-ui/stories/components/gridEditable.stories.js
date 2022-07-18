import {Component, Fragment} from 'react';
import PropTypes from 'prop-types';

import Button from 'sentry/components/button';
import GridEditable from 'sentry/components/gridEditable';

const COLUMN_ORDER = [
  {
    key: 'farm',
    name: 'farm',
    width: -1,
  },
  {
    key: 'count(apple)',
    name: 'apples sold',
    width: -1,
  },
  {
    key: 'count(banana)',
    name: 'banana sold',
    width: -1,
  },
];
const COLUMN_SORT_BY = [
  {
    key: 'count(apple)',
    order: -1,
  },
];
const DATA = [
  {
    farm: 'Old McDonalds',
    'count(apple)': 100,
    'count(banana)': 500,
    'count(cherry)': 200,
    'count(date)': 400,
    'count(eggplant)': 600,
  },
  {
    farm: 'Animal Farm',
    'count(apple)': 900,
    'count(banana)': 600,
    'count(cherry)': 200,
    'count(date)': 500,
    'count(eggplant)': 700,
  },
  {
    farm: 'Avocado Toast Farm',
    'count(apple)': 700,
    'count(banana)': 600,
    'count(cherry)': 500,
    'count(date)': 400,
    'count(eggplant)': 500,
  },
];

class GridParent extends Component {
  static propTypes = {
    withHeader: PropTypes.bool,
    title: PropTypes.string,
  };

  state = {
    columnOrder: [...COLUMN_ORDER],
    columnSortBy: [...COLUMN_SORT_BY],
  };

  handleResizeColumn = (index, newColumn) => {
    const columnOrder = [...this.state.columnOrder];
    columnOrder[index] = {...columnOrder[index], width: newColumn.width};
    this.setState({columnOrder});
  };

  render() {
    const {withHeader, title} = this.props;
    const headerButtons = withHeader
      ? () => <Button size="sm">Action Button</Button>
      : null;
    return (
      <GridEditable
        headerButtons={headerButtons}
        isLoading={false}
        error={null}
        data={DATA}
        columnOrder={this.state.columnOrder}
        columnSortBy={this.state.columnSortBy}
        title={title}
        grid={{
          onResizeColumn: this.handleResizeColumn,
        }}
      />
    );
  }
}

export default {
  title: 'Components/Tables/GridEditable',
};

export const Default = () => (
  <Fragment>
    <div className="section">
      <h2>Basic Table</h2>
      <GridParent />
    </div>
  </Fragment>
);

Default.storyName = 'default';
Default.parameters = {
  docs: {
    description: {
      story: 'Render a simple resizable table',
    },
  },
};

export const WithAHeader = () => (
  <div className="section">
    <h2>Table with title & header buttons</h2>
    <GridParent withHeader title="Results" />
  </div>
);

WithAHeader.storyName = 'with a header';
WithAHeader.parameters = {
  docs: {
    description: {
      story: 'Include a header and action buttons',
    },
  },
};

export const IsLoading = () => (
  <div className="section">
    <h2>Loading</h2>
    <GridEditable
      isEditable={false}
      isLoading
      error={null}
      data={DATA}
      columnOrder={COLUMN_ORDER}
      columnSortBy={COLUMN_SORT_BY}
      grid={{}}
    />
  </div>
);

IsLoading.storyName = 'isLoading';

export const IsError = () => (
  <div className="section">
    <h2>Error</h2>
    <GridEditable
      isEditable={false}
      isLoading
      error="These aren't the droids you're looking for."
      data={DATA}
      columnOrder={COLUMN_ORDER}
      columnSortBy={COLUMN_SORT_BY}
      grid={{}}
    />
  </div>
);

IsError.storyName = 'isError';
