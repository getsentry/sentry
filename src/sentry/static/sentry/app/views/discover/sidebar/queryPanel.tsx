import React from 'react';

import InlineSvg from 'app/components/inlineSvg';
import PageHeading from 'app/components/pageHeading';

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

          <QueryPanelCloseLink to="" onClick={onClose}>
            <InlineSvg src="icon-close" height="38px" />
          </QueryPanelCloseLink>
        </QueryPanelTitle>
        {this.props.children}
      </QueryPanelContainer>
    );
  }
}
