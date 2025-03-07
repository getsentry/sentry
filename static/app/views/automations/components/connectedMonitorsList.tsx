import {IssueCell} from 'sentry/components/workflowEngine/gridCell/issueCell';
import {NumberCell} from 'sentry/components/workflowEngine/gridCell/numberCell';
import {TitleCell} from 'sentry/components/workflowEngine/gridCell/titleCell';
import {defineColumns, SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {t} from 'sentry/locale';
import type {AvatarProject} from 'sentry/types/project';

interface Data {
  lastIssue: {platform: string; shortId: string};
  name: {link: string; name: string; project: AvatarProject};
  openIssues: number;
}

const data: Data[] = [
  {
    name: {
      name: 'Error Grouping',
      project: {
        slug: 'javascript',
        platform: 'javascript',
      },
      link: '/issues/1',
    },
    lastIssue: {shortId: 'JAVASCRIPT-SHGH', platform: 'javascript'},
    openIssues: 1,
  },
  {
    name: {
      name: 'Error Grouping',
      project: {
        slug: 'javascript',
        platform: 'javascript',
      },
      link: '/issues/1',
    },
    lastIssue: {shortId: 'JAVASCRIPT-SHGH', platform: 'javascript'},
    openIssues: 2,
  },
];

export default function ConnectedMonitorsList() {
  const columns = defineColumns<Data>({
    name: {
      Header: () => t('Name'),
      Cell: ({value}) => (
        <TitleCell name={value.name} project={value.project} link={value.link} />
      ),
      width: '3fr',
    },
    lastIssue: {
      Header: () => t('Last Issue'),
      Cell: ({value}) => <IssueCell group={value} />,
      width: '2fr',
    },
    openIssues: {
      Header: () => t('Open Issues'),
      Cell: ({value}) => <NumberCell number={value} />,
      width: '1fr',
    },
  });

  return <SimpleTable columns={columns} data={data} />;
}
