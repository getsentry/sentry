import { Component } from 'react';

import {IconClose} from 'app/icons/iconClose';
import PageHeading from 'app/components/pageHeading';

import {QueryPanelContainer, QueryPanelTitle, QueryPanelCloseLink} from '../styles';

type QueryPanelProps = {
  title: any;
  onClose: () => void;
};

export default class QueryPanel extends Component<QueryPanelProps> {
  render() {
    const {title, onClose} = this.props;
    return (
      <QueryPanelContainer>
        <QueryPanelTitle>
          <PageHeading>{title}</PageHeading>

          <QueryPanelCloseLink to="" onClick={onClose}>
            <IconClose color="gray400" />
          </QueryPanelCloseLink>
        </QueryPanelTitle>
        {this.props.children}
      </QueryPanelContainer>
    );
  }
}
