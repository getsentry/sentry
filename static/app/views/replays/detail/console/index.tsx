import styled from '@emotion/styled';

import {Panel} from 'sentry/components/panels';
import {BreadcrumbTypeDefault} from 'sentry/types/breadcrumbs';

import ConsoleMessage from './consoleMessage';

interface Props {
  breadcrumbs: BreadcrumbTypeDefault[];
}

function Console({breadcrumbs}: Props) {
  return (
    <ConsoleTable>
      {breadcrumbs.map((breadcrumb, i) => (
        <ConsoleMessage
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
  grid-template-columns: max-content auto;
  font-family: ${p => p.theme.text.familyMono};
  font-size: 0.8em;
`;

export default Console;
