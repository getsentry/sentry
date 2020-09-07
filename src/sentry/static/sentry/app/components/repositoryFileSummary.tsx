import React from 'react';
import styled from '@emotion/styled';

import {CommitAuthor} from 'app/types';
import {ListGroup, ListGroupItem} from 'app/components/listGroup';
import FileChange from 'app/components/fileChange';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';

type FileChangeSummary = Record<
  string,
  {
    authors: Record<string, CommitAuthor>;
    types: Set<'M' | 'A' | 'D'>;
  }
>;

type DefaultProps = {
  collapsable: boolean;
  maxWhenCollapsed: number;
};

type Props = DefaultProps & {
  fileChangeSummary: FileChangeSummary;
  repository: string;
};

type State = {
  loading: boolean;
  collapsed: boolean;
};

class RepositoryFileSummary extends React.Component<Props, State> {
  static defaultProps: DefaultProps = {
    collapsable: true,
    maxWhenCollapsed: 5,
  };

  state: State = {
    loading: true,
    collapsed: true,
  };

  onCollapseToggle = () => {
    this.setState(state => ({
      collapsed: !state.collapsed,
    }));
  };

  render() {
    const {repository, fileChangeSummary, collapsable, maxWhenCollapsed} = this.props;
    let files = Object.keys(fileChangeSummary);
    const fileCount = files.length;
    files.sort();
    if (this.state.collapsed && collapsable && fileCount > maxWhenCollapsed) {
      files = files.slice(0, maxWhenCollapsed);
    }
    const numCollapsed = fileCount - files.length;
    const canCollapse = collapsable && fileCount > maxWhenCollapsed;

    return (
      <Container>
        <h5>
          {tn(
            '%s file changed in ' + repository,
            '%s files changed in ' + repository,
            fileCount
          )}
        </h5>
        <ListGroup striped>
          {files.map(filename => {
            const {authors} = fileChangeSummary[filename];
            return (
              <FileChange
                key={filename}
                filename={filename}
                authors={Object.values(authors)}
              />
            );
          })}
          {numCollapsed > 0 && (
            <ListGroupItem centered>
              <a onClick={this.onCollapseToggle}>
                {tn('Show %s collapsed file', 'Show %s collapsed files', numCollapsed)}
              </a>
            </ListGroupItem>
          )}
          {numCollapsed === 0 && canCollapse && (
            <ListGroupItem centered>
              <a onClick={this.onCollapseToggle}>{t('Collapse')}</a>
            </ListGroupItem>
          )}
        </ListGroup>
      </Container>
    );
  }
}

const Container = styled('div')`
  margin-bottom: ${space(2)};
`;

export default RepositoryFileSummary;
