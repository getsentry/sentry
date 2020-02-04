import React from 'react';

import PageHeading from 'app/components/pageHeading';
import {IconClose} from 'app/icons';

import {QueryPanelContainer, QueryPanelTitle, QueryPanelCloseLink} from '../styles';

type QueryPanelProps = {
  title: any;
  onClose: () => void;
};

export default class QueryPanel extends React.Component<QueryPanelProps> {
  render() {
    const {title, onClose} = this.props;
    return (
      <QueryPanelContainer>
        <QueryPanelTitle>
          <PageHeading>{title}</PageHeading>

          <QueryPanelCloseLink onClick={onClose}>
            <IconClose size="xl" />
          </QueryPanelCloseLink>
        </QueryPanelTitle>
        {this.props.children}
      </QueryPanelContainer>
    );
  }
}
