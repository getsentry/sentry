import React from 'react';
import styled from '@emotion/styled';

import {Frame, SentryAppComponent, Event, Organization} from 'app/types';
import {t} from 'app/locale';
import {defined} from 'app/utils';
import ClippedBox from 'app/components/clippedBox';
import ContextLine from 'app/components/events/interfaces/contextLine';
import FrameRegisters from 'app/components/events/interfaces/frameRegisters/frameRegisters';
import FrameVariables from 'app/components/events/interfaces/frameVariables';
import ErrorBoundary from 'app/components/errorBoundary';
import {IconFlag} from 'app/icons';
import {Assembly} from 'app/components/events/interfaces/assembly';
import {parseAssembly} from 'app/components/events/interfaces/utils';
import {OpenInContextLine} from 'app/components/events/interfaces/openInContextLine';
import StacktraceLink from 'app/components/events/interfaces/stacktraceLink';
import withOrganization from 'app/utils/withOrganization';
import space from 'app/styles/space';

type Props = {
  frame: Frame;
  event: Event;
  organization: Organization;
  registers: {[key: string]: string};
  components: Array<SentryAppComponent>;
  isExpanded?: boolean;
  hasContextSource?: boolean;
  hasContextVars?: boolean;
  hasContextRegisters?: boolean;
  emptySourceNotation?: boolean;
  hasAssembly?: boolean;
  expandable?: boolean;
};

const Context = ({
  hasContextVars = false,
  hasContextSource = false,
  hasContextRegisters = false,
  isExpanded = false,
  hasAssembly = false,
  expandable = false,
  emptySourceNotation = false,
  registers,
  components,
  frame,
  event,
  organization,
}: Props) => {
  if (!hasContextSource && !hasContextVars && !hasContextRegisters && !hasAssembly) {
    return emptySourceNotation ? (
      <div className="empty-context">
        <StyledIconFlag size="xs" />
        <p>{t('No additional details are available for this frame.')}</p>
      </div>
    ) : null;
  }

  const getContextLines = () => {
    if (isExpanded) {
      return frame.context;
    }
    return frame.context.filter(l => l[0] === frame.lineNo);
  };

  const contextLines = getContextLines();

  const startLineNo = hasContextSource ? frame.context[0][0] : undefined;

  return (
    <ol start={startLineNo} className={`context ${isExpanded ? 'expanded' : ''}`}>
      {defined(frame.errors) && (
        <li className={expandable ? 'expandable error' : 'error'} key="errors">
          {frame.errors.join(', ')}
        </li>
      )}

      {frame.context &&
        contextLines.map((line, index) => {
          const isActive = frame.lineNo === line[0];
          const hasComponents = isActive && components.length > 0;
          return (
            <StyledContextLine key={index} line={line} isActive={isActive}>
              {hasComponents && (
                <ErrorBoundary mini>
                  <OpenInContextLine
                    key={index}
                    lineNo={line[0]}
                    filename={frame.filename || ''}
                    components={components}
                  />
                </ErrorBoundary>
              )}
              {organization.features.includes('integrations-stacktrace-link') &&
                isActive &&
                isExpanded && (
                  <ErrorBoundary mini>
                    <StacktraceLink
                      key={index}
                      lineNo={line[0]}
                      frame={frame}
                      event={event}
                    />
                  </ErrorBoundary>
                )}
            </StyledContextLine>
          );
        })}

      {(hasContextRegisters || hasContextVars) && (
        <StyledClippedBox clipHeight={100}>
          {hasContextRegisters && <FrameRegisters data={registers} key="registers" />}
          {hasContextVars && <FrameVariables data={frame.vars || {}} key="vars" />}
        </StyledClippedBox>
      )}

      {hasAssembly && (
        <Assembly {...parseAssembly(frame.package)} filePath={frame.absPath} />
      )}
    </ol>
  );
};

export default withOrganization(Context);

const StyledClippedBox = styled(ClippedBox)`
  margin-left: 0;
  margin-right: 0;

  &:first-of-type {
    margin-top: 0;
  }

  :first-child {
    margin-top: -${space(3)};
  }

  > *:first-child {
    padding-top: 0;
    border-top: none;
  }
`;

const StyledIconFlag = styled(IconFlag)`
  margin-right: ${space(1)};
`;

const StyledContextLine = styled(ContextLine)`
  background: inherit;
  padding: 0;
  text-indent: 20px;
  z-index: 1000;
`;
