import {Component} from 'react';
import cls from 'classnames';

import ModuleItem from './ModuleItem';
import s from './ModulesList.css';

export default class ModulesList extends Component {
  handleModuleClick = module => this.props.onModuleClick(module);

  render() {
    const {modules, showSize, highlightedText, isModuleVisible, className} = this.props;
    return (
      <div className={cls(s.container, className)}>
        {modules.map(module => (
          <ModuleItem
            key={module.cid}
            module={module}
            showSize={showSize}
            highlightedText={highlightedText}
            isVisible={isModuleVisible}
            onClick={this.handleModuleClick}
          />
        ))}
      </div>
    );
  }
}
