import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import {ListGroup, ListGroupItem} from 'app/components/listGroup';
import FileChange from 'app/components/fileChange';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';

function Collapsed(props) {
  return (
    <ListGroupItem centered>
      <a onClick={props.onClick}>
        {tn('Show %s collapsed file', 'Show %s collapsed files', props.count)}
      </a>
    </ListGroupItem>
  );
}

Collapsed.propTypes = {
  onClick: PropTypes.func.isRequired,
  count: PropTypes.number.isRequired,
};

class RepositoryFileSummary extends React.Component {
  static propTypes = {
    fileChangeSummary: PropTypes.object,
    repository: PropTypes.string,
    collapsable: PropTypes.bool,
    maxWhenCollapsed: PropTypes.number,
  };

  static defaultProps = {
    collapsable: true,
    maxWhenCollapsed: 5,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      loading: true,
      collapsed: true,
    };
  }

  onCollapseToggle = () => {
    this.setState({
      collapsed: !this.state.collapsed,
    });
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
            const {authors, types} = fileChangeSummary[filename];
            return (
              <FileChange
                key={filename}
                filename={filename}
                authors={Object.values(authors)}
                types={types}
              />
            );
          })}
          {numCollapsed > 0 && (
            <Collapsed onClick={this.onCollapseToggle} count={numCollapsed} />
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
