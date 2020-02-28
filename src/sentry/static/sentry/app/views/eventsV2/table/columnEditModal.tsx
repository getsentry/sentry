import React from 'react';

import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import {DISCOVER2_DOCS_URL} from 'app/constants';
import {ModalRenderProps} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import {OrganizationSummary} from 'app/types';
import {Column} from '../eventView';
import ColumnEditCollection from './columnEditCollection';

type Props = {
  columns: Column[];
  organization: OrganizationSummary;
  tagKeys: string[];
  // Fired when column selections have been applied.
  onApply: (columns: Column[]) => void;
} & ModalRenderProps;

type State = {
  columns: Column[];
};

class ColumnEditModal extends React.Component<Props, State> {
  state = {
    columns: this.props.columns,
  };

  handleChange = (columns: Column[]) => {
    this.setState({columns});
  };

  handleApply = () => {
    this.props.onApply(this.state.columns);
    this.props.closeModal();
  };

  render() {
    const {Header, Body, Footer, tagKeys, organization} = this.props;
    return (
      <React.Fragment>
        <Header>
          <h4>{t('Edit Columns')}</h4>
        </Header>
        <Body>
          <ColumnEditCollection
            organization={organization}
            columns={this.state.columns}
            tagKeys={tagKeys}
            onChange={this.handleChange}
          />
        </Body>
        <Footer>
          <ButtonBar gap={1}>
            <Button priority="default" to={DISCOVER2_DOCS_URL}>
              {t('Read the Docs')}
            </Button>
            <Button priority="primary" onClick={this.handleApply}>
              {t('Apply')}
            </Button>
          </ButtonBar>
        </Footer>
      </React.Fragment>
    );
  }
}

export default ColumnEditModal;
