import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import styled from '@emotion/styled';

import {defined} from 'app/utils';

const Context = styled('div')`
  display: inline;
`;

const ContextLine = function(props) {
  const {line, isActive, className, highlightRange} = props;
  let lineWs = '';
  let lineCode = '';
  if (defined(line[1]) && line[1].match) {
    [, lineWs, lineCode] = line[1].match(/^(\s*)(.*?)$/m);
    if (highlightRange) {
      let [start, end] = highlightRange;
      start -= lineWs.length;
      end -= lineWs.length;
      lineCode = (
        <React.Fragment>
          {lineCode.substring(0, start)}
          <span className="active">{lineCode.substring(start, end)}</span>
          {lineCode.substring(end, lineCode.length)}
        </React.Fragment>
      );
    }
  }
  const Component = !props.children ? React.Fragment : Context;
  return (
    <li className={classNames(className, 'expandable', {active: isActive})} key={line[0]}>
      <Component>
        <span className="ws">{lineWs}</span>
        <span className="contextline">{lineCode}</span>
      </Component>
      {props.children}
    </li>
  );
};

ContextLine.propTypes = {
  line: PropTypes.array.isRequired,
  isActive: PropTypes.bool,
  highlightRange: PropTypes.arrayOf(PropTypes.number),
};

export default ContextLine;
