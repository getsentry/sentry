import PropTypes from 'prop-types';
import React from 'react';
import SentryTypes from 'app/sentryTypes';
import OpenInButton from 'app/components/events/interfaces/openInButton';
import {defined} from 'app/utils';
import styled from 'react-emotion';

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
    <React.Fragment>
      {isActive ? (
        <OpenInButton
          group={group}
          filename={filename}
          lineNo={line[0]}
          lineWs={lineWs}
          lineCode={lineCode}
        />
      ) : (
        <ContextLineItem
          liClassName={liClassName}
          lineNo={line[0]}
          lineWs={lineWs}
          lineCode={lineCode}
        />
      )}
    </React.Fragment>
  );
};

ContextLine.propTypes = {
  line: PropTypes.array.isRequired,
  isActive: PropTypes.bool,
  filename: PropTypes.string,
  group: SentryTypes.Group,
};

export default ContextLine;

const ContextLineItem = function(props) {
  const {liClassName, lineNo, lineWs, lineCode} = props;
  return (
    <ListItem className={liClassName} key={lineNo}>
      <span className="ws">{lineWs}</span>
      <span className="contextline">{lineCode}</span>
    </ListItem>
  );
};

ContextLineItem.propTypes = {
  lineNo: PropTypes.number.isRequired,
  lineWs: PropTypes.string.isRequired,
  liClassName: PropTypes.string.isRequired,
  lineCode: PropTypes.string.isRequired,
};

export {ContextLineItem}

const ListItem = styled('li')`
  padding: 0 20px;
  background: inherit;
`;
