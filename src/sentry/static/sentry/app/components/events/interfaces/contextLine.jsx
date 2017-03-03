import React from 'react';
import {defined} from '../../../utils';

const ContextLine = function(props) {
  let {line, isActive} = props;
  let liClassName = 'expandable';
  if (isActive) {
    liClassName += ' active';
  }

  let lineWs = '';
  let lineCode = '';
  if (defined(line[1]) && line[1].match) {
    [, lineWs, lineCode] = line[1].match(/^(\s*)(.*?)$/m);
  }

  return (
    <li className={liClassName} key={line[0]}>
      <span className="ws">{lineWs}</span><span className="contextline">{lineCode}</span>
    </li>
  );
};

ContextLine.propTypes = {
  line: React.PropTypes.array.isRequired,
  isActive: React.PropTypes.bool
};

export default ContextLine;
