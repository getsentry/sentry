import PropTypes from 'prop-types';
import React from 'react';
import SentryTypes from 'app/sentryTypes';
import {defined} from 'app/utils';
import OpenInButton from 'app/components/events/interfaces/openInButton';

const ContextLine = function(props) {
  const {line, isActive, filename, group} = props;
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
      {isActive && <OpenInButton filename={filename} lineNo={line[0]} group={group} />}
    </li>
  );
};

ContextLine.propTypes = {
  line: PropTypes.array.isRequired,
  isActive: PropTypes.bool,
  filename: PropTypes.string,
  group: SentryTypes.Group,
};

export default ContextLine;
