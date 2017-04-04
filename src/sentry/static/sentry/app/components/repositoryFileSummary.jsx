import React from 'react';
import FileChange from './fileChange';
import {t, tn} from '../locale';

function Collapsed(props) {
  return (
    <li className="list-group-item list-group-item-sm align-center">
      <span className="icon-container">
      </span>
      <a onClick={props.onClick}>{tn(('Show %d collapsed file'), ('Show %d collapsed files'), props.count)}</a>
    </li>
  );
}

Collapsed.propTypes = {
  onClick: React.PropTypes.func.isRequired,
  count: React.PropTypes.number.isRequired
};

const RepositoryFileSummary = React.createClass({
  propTypes: {
    fileChangeSummary: React.PropTypes.object,
    repository: React.PropTypes.string,
  },

  statics: {
    MAX_WHEN_COLLAPSED: 5
  },

  getInitialState() {
    return {
      loading: true,
      collapsed: true,
    };
  },

  onCollapseToggle() {
    this.setState({
      collapsed: !this.state.collapsed
    });
  },

  render() {
    let {repository, fileChangeSummary} = this.props;
    const MAX = RepositoryFileSummary.MAX_WHEN_COLLAPSED;
    let files = Object.keys(fileChangeSummary);
    let fileCount = files.length;
    files.sort();
    if (this.state.collapsed && fileCount > MAX) {
      files = files.slice(0, MAX);
    }
    let numCollapsed = fileCount - files.length;
    let canCollapse = fileCount > MAX;
    return(
      <div>
        <h5>
          {tn(('%d file changed in ' + repository), ('%d files changed in ' + repository), fileCount)}
        </h5>
        <ul className="list-group list-group-striped m-b-2">
        {files.map(filename => {
          let {id, authors, types} = fileChangeSummary[filename];
          return (
            <FileChange
              key={id}
              filename={filename}
              authors={Object.values(authors)}
              types={types}
              />
          );
        })}
        {numCollapsed > 0 && <Collapsed onClick={this.onCollapseToggle} count={numCollapsed}/>}
        {numCollapsed === 0 && canCollapse &&
          <li className="list-group-item list-group-item-sm align-center">
            <span className="icon-container"></span>
            <a onClick={this.onCollapseToggle}>{t('Collapse')}</a>
          </li>
        }
        </ul>
      </div>);
}
});

export default RepositoryFileSummary;
