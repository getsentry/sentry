import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import {defined} from 'app/utils';
import styled from 'react-emotion';

const ContextLine = function(props) {
  const {line, isActive, className} = props;
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
    <li className={classNames(className, liClassName)} key={line[0]}>
      {props.children === null ? (
        <React.Fragment>
          <span className="ws">{lineWs}</span>
          <span className="contextline">{lineCode}</span>
        </React.Fragment>
      ) : (
        <Context>
          <span className="ws">{lineWs}</span>
          <span className="contextline">{lineCode}</span>
        </Context>
      )}
      {props.children}
    </li>
  );
};

ContextLine.propTypes = {
  line: PropTypes.array.isRequired,
  isActive: PropTypes.bool,
};

export default ContextLine;

const Context = styled('div')`
  display: inline;
`;
