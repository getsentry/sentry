import styled from '@emotion/styled';

import {Panel} from 'sentry/components/panels';
import {showPlayerTime} from 'sentry/components/replays/utils';
import {BreadcrumbTypeDefault} from 'sentry/types/breadcrumbs';

import ConsoleMessage from './consoleMessage';

interface Props {
  breadcrumbs: BreadcrumbTypeDefault[];
  startTimestamp: number;
}

function Console({breadcrumbs, startTimestamp = 0}: Props) {
  return (
    <ConsoleTable>
      {breadcrumbs.map((breadcrumb, i) => (
        <ConsoleMessage
          relativeTimestamp={showPlayerTime(breadcrumb.timestamp || '', startTimestamp)}
          key={i}
          isLast={i === breadcrumbs.length - 1}
          breadcrumb={breadcrumb}
        />
      ))}
    </ConsoleTable>
  );
}

const ConsoleTable = styled(Panel)`
  display: grid;
  grid-template-columns: max-content auto auto;
  width: 100%;
  font-family: ${p => p.theme.text.familyMono};
  font-size: 0.8em;
`;

export default Console;
