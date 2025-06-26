import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {DateTime} from 'sentry/components/dateTime';
import Link from 'sentry/components/links/link';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {useTimezone} from 'sentry/components/timezoneProvider';
import {tct} from 'sentry/locale';

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
        <SimpleTable.HeaderCell className="dateSent">
          {tct('Time Sent ([timezone])', {timezone: moment.tz(timezone).zoneAbbr()})}
        </SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell className="monitor">Monitor</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell className="groupId">Issue</SimpleTable.HeaderCell>
      </SimpleTable.Header>
      {history.length === 0 && <SimpleTable.Empty>No history found</SimpleTable.Empty>}
      {history.map((row, index) => (
        <SimpleTable.Row key={index}>
          <SimpleTable.RowCell className="dateSent">
            <DateTime date={row.dateSent} forcedTimezone={timezone} />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell className="monitor">
            <Link to={row.monitor.link}>{row.monitor.name}</Link>
          </SimpleTable.RowCell>
          <SimpleTable.RowCell className="groupId">
            <Link to={`/issues/${row.groupId}`}>{`#${row.groupId}`}</Link>
          </SimpleTable.RowCell>
        </SimpleTable.Row>
      ))}
    </SimpleTableWithColumns>
  );
}

const SimpleTableWithColumns = styled(SimpleTable)`
  grid-template-columns: 1fr 2fr 2fr;
`;
