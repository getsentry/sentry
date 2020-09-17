import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import SentryTypes from 'app/sentryTypes';
import {t} from 'app/locale';
import Pagination from 'app/components/pagination';
import SimilarSpectrum from 'app/components/similarSpectrum';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {Panel, PanelBody} from 'app/components/panels';
import space from 'app/styles/space';

import Item from './item';
import SimilarToolbar from './toolbar';

const SimilarItemPropType = PropTypes.shape({
  issue: SentryTypes.Group,
  project: SentryTypes.Project,
  score: PropTypes.object,
  avgScore: PropTypes.number,
  isBelowThreshold: PropTypes.bool,
});

class List extends React.Component {
  static propTypes = {
    orgId: PropTypes.string.isRequired,
    groupId: PropTypes.string.isRequired,
    onMerge: PropTypes.func.isRequired,
    pageLinks: PropTypes.string,
    items: PropTypes.arrayOf(SimilarItemPropType),
    filteredItems: PropTypes.arrayOf(SimilarItemPropType),
  };

  static defaultProps = {
    filteredItems: [],
  };

  constructor(...args) {
    super(...args);
    this.state = {
      showAllItems: false,
    };
  }

  renderEmpty = () => (
    <Panel>
      <PanelBody>
        <EmptyStateWarning small withIcon={false}>
          {t('No issues with a similar stack trace have been found.')}
        </EmptyStateWarning>
      </PanelBody>
    </Panel>
  );

  handleShowAll = () => {
    this.setState({showAllItems: true});
  };

  render() {
    const {
      orgId,
      groupId,
      project,
      items,
      filteredItems,
      pageLinks,
      onMerge,
    } = this.props;
    const hasHiddenItems = !!filteredItems.length;
    const hasResults = items.length > 0 || hasHiddenItems;
    const itemsWithFiltered = items.concat(
      (this.state.showAllItems && filteredItems) || []
    );

    if (!hasResults) {
      return this.renderEmpty();
    }

    return (
      <Wrapper className="similar-list-container">
        <Header>
          <SimilarSpectrum />
        </Header>
        <SimilarToolbar onMerge={onMerge} />
        <div className="similar-list">
          {itemsWithFiltered.map(item => (
            <Item
              key={item.issue.id}
              orgId={orgId}
              groupId={groupId}
              project={project}
              {...item}
            />
          ))}

          {hasHiddenItems && !this.state.showAllItems && (
            <div className="similar-items-footer">
              <button className="btn btn-default btn-xl" onClick={this.handleShowAll}>
                Show {filteredItems.length} issues below threshold
              </button>
            </div>
          )}
        </div>
        <Pagination pageLinks={pageLinks} />
      </Wrapper>
    );
  }
}

export default List;

const Wrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

const Header = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-bottom: ${space(1)};
`;
