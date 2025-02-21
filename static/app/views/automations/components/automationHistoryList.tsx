import moment from 'moment-timezone';

import {DateTime} from 'sentry/components/dateTime';
import Link from 'sentry/components/links/link';
import {defineColumns, SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {t} from 'sentry/locale';

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
  const columns = defineColumns<Data>({
    dateSent: {
      Header: () => t('Time sent'),
      Cell: ({value}) => <DateTime date={value} />,
    },
    monitor: {
      Header: () => t('Monitor'),
      Cell: ({value}) => <Link to={value.link}>{value.name}</Link>,
    },
    groupId: {
      Header: () => t('Issue'),
      Cell: ({value}) => <Link to={`/issues/${value}`}>{`#${value}`}</Link>,
    },
  });

  return <SimpleTable columns={columns} data={data} />;
}
