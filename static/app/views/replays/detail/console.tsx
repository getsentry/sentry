import styled from '@emotion/styled';

import {Panel} from 'sentry/components/panels';
import space from 'sentry/styles/space';
import type {BreadcrumbTypeConsole} from 'sentry/types/breadcrumbs';

interface Props {
  consoleMessages: BreadcrumbTypeConsole[];
  className?: string;
}

function BaseConsole({className, consoleMessages}: Props) {
  return (
    <Panel className={className}>
      {consoleMessages.map((message, i) => {
        return (
          <Row key={i} isLast={i === consoleMessages.length - 1}>
            {message.message}
          </Row>
        );
      })}
    </Panel>
  );
}

const Console = styled(BaseConsole)`
  font-family: ${p => p.theme.text.familyMono};
  font-size: 0.9em;
`;

const Row = styled('div')<{isLast?: boolean}>`
  ${p => (p.isLast ? '' : `border-bottom: 1px solid ${p.theme.innerBorder}`)};
  padding: ${space(0.25)} ${space(0.5)};
`;

export default Console;
