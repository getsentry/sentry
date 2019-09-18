import React from 'react';

import {t} from 'app/locale';

export type GridModalEditColumnProps<Column> = {
  indexOfColumnOrder?: number;
  column?: Column;

  renderBody: (indexOfColumnOrder?: number, column?: Column) => React.ReactNode;
  renderFooter: () => React.ReactNode;

  /**
   * These are props passed in by the openModal function
   * See 'app/actionCreators/modal' for more info
   */
  Header: React.ComponentType;
  Body: React.ComponentType;
  Footer: React.ComponentType;
  closeModal: () => void;
};

class GridModalEditColumn<Column> extends React.Component<
  GridModalEditColumnProps<Column>
> {
  static defaultProps = {
    data: {},
  };

  renderHeader() {
    const {column} = this.props;
    return <h4>{column ? t('Edit Column') : t('New Column')}</h4>;
  }

  render() {
    const {
      Header,
      Body,
      Footer,
      indexOfColumnOrder,
      column,
      renderBody,
      renderFooter,
    } = this.props;

    return (
      <React.Fragment>
        <Header>{this.renderHeader()}</Header>
        <Body>{renderBody(indexOfColumnOrder, column)}</Body>
        <Footer>{renderFooter()}</Footer>
      </React.Fragment>
    );
  }
}

export default GridModalEditColumn;
