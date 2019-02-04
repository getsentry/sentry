import PropTypes from 'prop-types';
import React from 'react';
import {defined} from 'app/utils';

const ContextLine = function(props) {
  const {line, isActive} = props;
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
      <span className="ws">{lineWs}</span>
      <span className="contextline">{lineCode}</span>
    </li>
  );
};

ContextLine.propTypes = {
  line: PropTypes.array.isRequired,
  isActive: PropTypes.bool,
};

export default ContextLine;
