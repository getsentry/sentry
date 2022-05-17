import styled from '@emotion/styled';
import moment from 'moment';

import {Panel} from 'sentry/components/panels';
import {BreadcrumbTypeDefault} from 'sentry/types/breadcrumbs';
import {getFormattedDate} from 'sentry/utils/dates';

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
          relativeTimestamp={getFormattedDate(
            (moment(breadcrumb.timestamp).unix() - startTimestamp) * 1000,
            'HH:mm:ss'
          )}
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
