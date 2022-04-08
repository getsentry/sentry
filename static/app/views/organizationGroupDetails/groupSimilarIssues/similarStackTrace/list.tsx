import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Pagination from 'sentry/components/pagination';
import {Panel, PanelBody} from 'sentry/components/panels';
import SimilarSpectrum from 'sentry/components/similarSpectrum';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Group, Organization, Project} from 'sentry/types';

import Item from './item';
import Toolbar from './toolbar';

type SimilarItem = {
  isBelowThreshold: boolean;
  issue: Group;
  aggregate?: {
    exception: number;
    message: number;
  };
  score?: Record<string, number | null>;
  scoresByInterface?: {
    exception: Array<[string, number | null]>;
    message: Array<[string, any | null]>;
  };
};

type DefaultProps = {
  filteredItems: Array<SimilarItem>;
};

type Props = {
  groupId: string;
  items: Array<SimilarItem>;
  onMerge: () => void;
  orgId: Organization['id'];
  pageLinks: string | null;
  project: Project;
  v2: boolean;
} & DefaultProps;

type State = {
  showAllItems: boolean;
};

class List extends Component<Props, State> {
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
    const {orgId, groupId, project, items, filteredItems, pageLinks, onMerge, v2} =
      this.props;

    const {showAllItems} = this.state;

    const hasHiddenItems = !!filteredItems.length;
    const hasResults = items.length > 0 || hasHiddenItems;
    const itemsWithFiltered = items.concat((showAllItems && filteredItems) || []);

    if (!hasResults) {
      return this.renderEmpty();
    }

    return (
      <Fragment>
        <Header>
          <SimilarSpectrum />
        </Header>

        <Panel>
          <Toolbar v2={v2} onMerge={onMerge} />

          <PanelBody>
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
          </PanelBody>
        </Panel>
        <Pagination pageLinks={pageLinks} />
      </Fragment>
    );
  }
}

export default List;

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
