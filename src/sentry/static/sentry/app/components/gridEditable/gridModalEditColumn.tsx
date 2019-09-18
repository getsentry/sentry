import React from 'react';

import {t} from 'app/locale';
// import Button from 'app/components/button';
// import {Form, SelectField, TextField} from 'app/components/forms';
// import InlineSvg from 'app/components/inlineSvg';
// import space from 'app/styles/space';

export type GridModalEditColumnProps<Column> = {
  column?: Column;

  renderBody: {(column?: Column): React.ReactNode};
  renderFooter: {(): React.ReactNode};

  /**
   * These are props passed in by the openModal function
   * See 'app/actionCreators/modal' for more info
   */
  Header: React.ComponentType;
  Body: React.ComponentType;
  Footer: React.ComponentType;
  closeModal: {(): void};
};

/**
 * GridModalEditColumn is rather opinionated as it is implemented for
 */
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
    const {Header, Body, Footer, column, renderBody, renderFooter} = this.props;

    return (
      <>
        <Header>{this.renderHeader()}</Header>
        <Body>{renderBody(column)}</Body>
        <Footer>{renderFooter()}</Footer>
      </>
    );
  }
}

export default GridModalEditColumn;
