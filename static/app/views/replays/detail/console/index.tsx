import styled from '@emotion/styled';

import {Panel} from 'sentry/components/panels';
import {BreadcrumbTypeDefault} from 'sentry/types/breadcrumbs';

import ConsoleMessage from './consoleMessage';

interface Props {
  breadcrumbs: BreadcrumbTypeDefault[];
  className?: string;
}

function BaseConsole({className, breadcrumbs}: Props) {
  return (
    <ConsoleTable className={className}>
      {breadcrumbs.map((breadcrumb, i) => {
        return (
          <ConsoleMessage
            key={i}
            isLast={i === breadcrumbs.length - 1}
            breadcrumb={breadcrumb}
          />
        );
      })}
    </ConsoleTable>
  );
}

const Console = styled(BaseConsole)`
  font-family: ${p => p.theme.text.familyMono};
  font-size: 0.8em;
`;

const ConsoleTable = styled(Panel)`
  display: grid;
  grid-template-columns: max-content auto;
`;

export default Console;
