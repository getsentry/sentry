import React from 'react';
import {storiesOf} from '@storybook/react';
import {withInfo} from '@storybook/addon-info';
import styled from 'react-emotion';

import Button from 'app/components/button';
import GlobalModal from 'app/components/globalModal';
import GridEditable from 'app/components/gridEditable';

const Section = styled('div')`
  margin-bottom: 32px;
`;

const COLUMN_ORDER = [
  {
    key: 'farm',
    name: 'farm',
  },
  {
    key: 'count(apple)',
    name: 'apples sold',
  },
  {
    key: 'count(banana)',
    name: 'banana sold',
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

class GridParent extends React.Component {
  state = {
    columnOrder: [...COLUMN_ORDER],
    columnSortBy: [...COLUMN_SORT_BY],
  };

  createColumn = () => {
    const dataRow = DATA[0];
    const keys = Object.keys(dataRow);
    const randomKey = keys[Math.floor(Math.random() * keys.length)];

    this.setState({
      columnOrder: [
        ...this.state.columnOrder,
        {
          key: randomKey,
          name: randomKey,
        },
      ],
    });
  };

  updateColumn = (i, nextColumn) => {
    const {columnOrder} = this.state;

    this.setState({
      columnOrder: [...columnOrder.slice(0, i), nextColumn, ...columnOrder.slice(i + 1)],
    });
  };

  deleteColumn = i => {
    const {columnOrder} = this.state;

    this.setState({
      columnOrder: [...columnOrder.slice(0, i), ...columnOrder.slice(i + 1)],
    });
  };

  renderModalBodyWithForm = (i, column) => {
    return (
      <React.Fragment>
        {column ? (
          <Button onClick={() => this.updateColumn(i, {...column, name: 'Sentry'})}>
            Rename this column to "Sentry"
          </Button>
        ) : (
          <Button onClick={this.createColumn}>Add a random column</Button>
        )}
        <br />
        <br />
        <div>You should create a user-friendly form here to edit the columns</div>
      </React.Fragment>
    );
  };

  renderModalFooter = () => {
    return <div>This is the footer</div>;
  };

  render() {
    return (
      <GridEditable
        isEditable
        isLoading={false}
        error={null}
        data={DATA}
        columnOrder={this.state.columnOrder}
        columnSortBy={this.state.columnSortBy}
        grid={{}}
        modalEditColumn={{
          renderBodyWithForm: this.renderModalBodyWithForm,
          renderFooter: this.renderModalFooter,
        }}
        actions={{
          deleteColumn: this.deleteColumn,
          moveColumn: () => {},
        }}
      />
    );
  }
}

storiesOf('UI|GridEditable', module)
  .add(
    'default',
    withInfo('There is a dependency on GlobalModal to display the Modal')(() => (
      <React.Fragment>
        <Section>
          <h2>{'isEditable={true}'}</h2>
          <GridParent />
        </Section>
        <Section>
          <h2>{'isEditable={false}'}</h2>
          <GridEditable
            isEditable={false}
            isLoading={false}
            error={null}
            data={DATA}
            columnOrder={COLUMN_ORDER}
            columnSortBy={COLUMN_SORT_BY}
            grid={{}}
            modalEditColumn={{
              renderBodyWithForm: () => {},
              renderFooter: () => {},
            }}
            actions={{
              deleteColumn: () => {},
              moveColumn: () => {},
            }}
          />
        </Section>
        <GlobalModal />
      </React.Fragment>
    ))
  )
  .add(
    'isLoading',
    withInfo('')(() => (
      <Section>
        <h2>Loading</h2>
        <GridEditable
          isEditable={false}
          isLoading
          error={null}
          data={DATA}
          columnOrder={COLUMN_ORDER}
          columnSortBy={COLUMN_SORT_BY}
          grid={{}}
          modalEditColumn={{
            renderBodyWithForm: () => <div>ModalBody</div>,
            renderFooter: () => <div>ModalFooter</div>,
          }}
          actions={{
            deleteColumn: () => {},
            moveColumn: () => {},
          }}
        />
      </Section>
    ))
  )
  .add(
    'isError',
    withInfo('')(() => (
      <Section>
        <h2>Error</h2>
        <GridEditable
          isEditable={false}
          isLoading
          error="These aren't the droids you're looking for."
          data={DATA}
          columnOrder={COLUMN_ORDER}
          columnSortBy={COLUMN_SORT_BY}
          grid={{}}
          modalEditColumn={{
            renderBodyWithForm: () => <div>ModalBody</div>,
            renderFooter: () => <div>ModalFooter</div>,
          }}
          actions={{
            deleteColumn: () => {},
            moveColumn: () => {},
          }}
        />
      </Section>
    ))
  );
