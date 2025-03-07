import moment from 'moment-timezone';

import {DateTime} from 'sentry/components/dateTime';
import Link from 'sentry/components/links/link';
import {defineColumns, SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';

interface Data {
  dateSent: Date;
  groupId: string;
  monitor: {link: string; name: string};
}

const data: Data[] = [
  {
    dateSent: moment().subtract(1, 'day').toDate(),
    monitor: {link: '/monitors/1', name: 'Errors high'},
    groupId: '143567',
  },
  {
    dateSent: moment().subtract(2, 'days').toDate(),
    monitor: {link: '/monitors/1', name: 'Slow endpoint'},
    groupId: '143566',
  },
  {
    dateSent: moment().subtract(3, 'days').toDate(),
    monitor: {link: '/monitors/1', name: 'Errors (fingerprinting)'},
    groupId: '143565',
  },
];

export default function AutomationHistoryList() {
  const {
    options: {timezone},
  } = ConfigStore.get('user');

  const columns = defineColumns<Data>({
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

  return <SimpleTable columns={columns} data={data} />;
}
