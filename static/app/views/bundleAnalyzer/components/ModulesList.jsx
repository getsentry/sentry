import cls from 'classnames';

import ModuleItem from './ModuleItem';
import s from './ModulesList.css';

function ModulesList({
  modules,
  showSize,
  highlightedText,
  isModuleVisible,
  className,
  onModuleClick,
}) {
  return (
    <div className={cls(s.container, className)}>
      {modules.map(module => (
        <ModuleItem
          key={module.cid}
          module={module}
          showSize={showSize}
          highlightedText={highlightedText}
          isVisible={isModuleVisible}
          onClick={m => onModuleClick(m)}
        />
      ))}
    </div>
  );
}

export default ModulesList;
