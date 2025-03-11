import moment from 'moment-timezone';

import {DateTime} from 'sentry/components/dateTime';
import Link from 'sentry/components/links/link';
import {defineColumns, SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';

interface AutomationHistoryData {
  dateSent: Date;
  groupId: string;
  monitor: {link: string; name: string};
}

type Props = {
  history: AutomationHistoryData[];
};

const getColumns = (timezone: string) =>
  defineColumns<AutomationHistoryData>({
    dateSent: {
      Header: () =>
        tct('Time Sent ([timezone])', {timezone: moment.tz(timezone).zoneAbbr()}),
      Cell: ({value}) => <DateTime date={value} forcedTimezone={timezone} />,
      width: '1fr',
    },
    monitor: {
      Header: () => t('Monitor'),
      Cell: ({value}) => <Link to={value.link}>{value.name}</Link>,
      width: '2fr',
    },
    groupId: {
      Header: () => t('Issue'),
      Cell: ({value}) => <Link to={`/issues/${value}`}>{`#${value}`}</Link>,
      width: '2fr',
    },
  });

export default function AutomationHistoryList({history}: Props) {
  const {
    options: {timezone},
  } = ConfigStore.get('user');

  const columns = getColumns(timezone);

  return <SimpleTable columns={columns} data={history} />;
}
