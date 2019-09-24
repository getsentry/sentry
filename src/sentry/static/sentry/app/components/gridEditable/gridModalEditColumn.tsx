import React from 'react';

import {t} from 'app/locale';

export type GridModalEditColumnProps<Column> = {
  indexColumnOrder?: number;
  column?: Column;

  renderBodyWithForm: (
    indexColumnOrder?: number,
    column?: Column,
    onSubmit?: (column: Column) => void,
    onSuccess?: () => void,
    onError?: () => void
  ) => React.ReactNode;
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
      closeModal,
      indexColumnOrder,
      column,
      renderBodyWithForm,
      renderFooter,
    } = this.props;

    return (
      <React.Fragment>
        <Header>{this.renderHeader()}</Header>
        <Body>{renderBodyWithForm(indexColumnOrder, column, undefined, closeModal)}</Body>
        <Footer>{renderFooter()}</Footer>
      </React.Fragment>
    );
  }
}

export default GridModalEditColumn;
