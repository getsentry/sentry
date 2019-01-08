import React from 'react';
import PropTypes from 'prop-types';

import InlineSvg from 'app/components/inlineSvg';
import PageHeading from 'app/components/pageHeading';

import {QueryPanelContainer, QueryPanelTitle, QueryPanelCloseLink} from '../styles';

export default class QueryPanel extends React.Component {
  static propTypes = {
    title: PropTypes.node.isRequired,
    onClose: PropTypes.func.isRequired,
  };
  render() {
    const {title, onClose} = this.props;
    return (
      <QueryPanelContainer>
        <QueryPanelTitle>
          <PageHeading>{title}</PageHeading>

          <QueryPanelCloseLink onClick={onClose}>
            <InlineSvg src="icon-close" height="38px" />
          </QueryPanelCloseLink>
        </QueryPanelTitle>
        {this.props.children}
      </QueryPanelContainer>
    );
  }
}
