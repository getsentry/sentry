import PropTypes from 'prop-types';
import React from 'react';
import FileChange from 'app/components/fileChange';
import {t, tn} from 'app/locale';

function Collapsed(props) {
  return (
    <li className="list-group-item list-group-item-sm align-center">
      <span className="icon-container" />
      <a onClick={props.onClick}>
        {tn('Show %s collapsed file', 'Show %s collapsed files', props.count)}
      </a>
    </li>
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
  };

  static MAX_WHEN_COLLAPSED = 5;

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
    const {repository, fileChangeSummary} = this.props;
    const MAX = RepositoryFileSummary.MAX_WHEN_COLLAPSED;
    let files = Object.keys(fileChangeSummary);
    const fileCount = files.length;
    files.sort();
    if (this.state.collapsed && fileCount > MAX) {
      files = files.slice(0, MAX);
    }
    const numCollapsed = fileCount - files.length;
    const canCollapse = fileCount > MAX;
    return (
      <div>
        <h5>
          {tn(
            '%s file changed in ' + repository,
            '%s files changed in ' + repository,
            fileCount
          )}
        </h5>
        <ul className="list-group list-group-striped m-b-2">
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
            <li className="list-group-item list-group-item-sm align-center">
              <span className="icon-container" />
              <a onClick={this.onCollapseToggle}>{t('Collapse')}</a>
            </li>
          )}
        </ul>
      </div>
    );
  }
}

export default RepositoryFileSummary;
