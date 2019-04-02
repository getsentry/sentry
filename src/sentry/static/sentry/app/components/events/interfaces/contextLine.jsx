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
        <ListItem className={liClassName} key={line[0]}>
          <span className="ws">{lineWs}</span>
          <span className="contextline">{lineCode}</span>
        </ListItem>
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

const ListItem = styled('li')`
  padding: 0 20px;
  background: inherit;
`;
