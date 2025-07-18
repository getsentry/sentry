import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Link} from 'sentry/components/core/link';
import {DateTime} from 'sentry/components/dateTime';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {useTimezone} from 'sentry/components/timezoneProvider';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface AutomationHistoryData {
  dateSent: Date;
  groupId: string;
  monitor: {link: string; name: string};
}

type Props = {
  history: AutomationHistoryData[];
};

export default function AutomationHistoryList({history}: Props) {
  const timezone = useTimezone();

  return (
    <SimpleTableWithColumns>
      <SimpleTable.Header>
        <SimpleTable.HeaderCell>
          {tct('Time Sent ([timezone])', {timezone: moment.tz(timezone).zoneAbbr()})}
        </SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>Monitor</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>Issue</SimpleTable.HeaderCell>
      </SimpleTable.Header>
      {history.length === 0 && <SimpleTable.Empty>No history found</SimpleTable.Empty>}
      {history.map((row, index) => (
        <SimpleTable.Row key={index}>
          <SimpleTable.RowCell>
            <DateTime date={row.dateSent} forcedTimezone={timezone} />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <Link to={row.monitor.link}>{row.monitor.name}</Link>
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <Link to={`/issues/${row.groupId}`}>{`#${row.groupId}`}</Link>
          </SimpleTable.RowCell>
        </SimpleTable.Row>
      ))}
    </SimpleTableWithColumns>
  );
}

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: 1fr 2fr 2fr;

  margin-bottom: ${space(2)};
`;
