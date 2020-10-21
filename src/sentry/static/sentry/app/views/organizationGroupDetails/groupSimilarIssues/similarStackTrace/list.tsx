import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import Pagination from 'app/components/pagination';
import Button from 'app/components/button';
import SimilarSpectrum from 'app/components/similarSpectrum';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import {Panel, PanelBody} from 'app/components/panels';
import space from 'app/styles/space';
import {Organization, Project, Group} from 'app/types';

import Item from './item';
import SimilarToolbar from './toolbar';

type SimilarItem = {
  issue: Group;
  score: Record<string, any>;
  avgScore: number;
  isBelowThreshold: boolean;
};

type DefaultProps = {
  filteredItems: Array<SimilarItem>;
};

type Props = {
  orgId: Organization;
  project: Project;
  onMerge: () => void;
  groupId: string;
  pageLinks: string | null;
  items: Array<SimilarItem>;
} & DefaultProps;

type State = {
  showAllItems: boolean;
};

class List extends React.Component<Props, State> {
  static defaultProps: DefaultProps = {
    filteredItems: [],
  };

  state: State = {
    showAllItems: false,
  };

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

    const {showAllItems} = this.state;

    const hasHiddenItems = !!filteredItems.length;
    const hasResults = items.length > 0 || hasHiddenItems;
    const itemsWithFiltered = items.concat((showAllItems && filteredItems) || []);

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

          {hasHiddenItems && !showAllItems && (
            <Footer>
              <Button onClick={this.handleShowAll}>
                {t('Show %s issues below threshold', filteredItems.length)}
              </Button>
            </Footer>
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

const Footer = styled('div')`
  display: flex;
  justify-content: center;
  padding: 12px;
`;
