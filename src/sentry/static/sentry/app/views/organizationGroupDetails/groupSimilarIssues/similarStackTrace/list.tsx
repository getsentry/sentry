import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import Pagination from 'app/components/pagination';
import {Panel, PanelBody} from 'app/components/panels';
import SimilarSpectrum from 'app/components/similarSpectrum';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Group, Organization, Project} from 'app/types';

import Item from './item';
import Toolbar from './toolbar';

type SimilarItem = {
  issue: Group;
  isBelowThreshold: boolean;
  score?: Record<string, number | null>;
  scoresByInterface?: {
    exception: Array<[string, number | null]>;
    message: Array<[string, any | null]>;
  };
  aggregate?: {
    exception: number;
    message: number;
  };
};

type DefaultProps = {
  filteredItems: Array<SimilarItem>;
};

type Props = {
  orgId: Organization['id'];
  project: Project;
  onMerge: () => void;
  v2: boolean;
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
      v2,
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
        <Toolbar v2={v2} onMerge={onMerge} />
        <div className="similar-list">
          {itemsWithFiltered.map(item => (
            <Item
              key={item.issue.id}
              orgId={orgId}
              v2={v2}
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
  padding: ${space(1.5)};
`;
