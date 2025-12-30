import moment from 'moment-timezone';

import {Tag, type TagProps} from 'sentry/components/core/badge/tag';
import {getOnboardingTasks} from 'sentry/components/onboardingWizard/taskConfig';
import {IconCheckmark, IconClock, IconNot} from 'sentry/icons';

import ResultGrid from 'admin/components/resultGrid';

type Props = Partial<React.ComponentProps<typeof ResultGrid>> & {
  orgId: string;
};

type Status = 'complete' | 'pending' | 'skipped';

type StatusTag = {
  icon: React.ReactNode;
  tagType: TagProps['variant'];
};

const tagPriority: Record<Status, StatusTag> = {
  pending: {icon: <IconClock size="xs" />, tagType: 'muted'},
  skipped: {icon: <IconNot size="xs" />, tagType: 'warning'},
  complete: {icon: <IconCheckmark size="xs" />, tagType: 'success'},
};

function CustomerOnboardingTasks({orgId, ...props}: Props) {
  const allTasks = getOnboardingTasks({organization: {slug: orgId, features: []} as any});

  return (
    <ResultGrid
      path={`/_admin/customers/${orgId}/`}
      endpoint={`/internal-stats/${orgId}/onboarding-tasks/`}
      method="GET"
      defaultParams={{per_page: 10}}
      useQueryString={false}
      keyForRow={row => row.task}
      columns={[
        <th key="task">Task</th>,
        <th key="status">Status</th>,
        <th key="date" style={{width: 250}}>
          When
        </th>,
      ]}
      columnsForRow={(row: any) => {
        const {completed, task} = row;
        const onboardingTask = allTasks.find(t => t.task === task);

        if (!onboardingTask?.display) {
          return [null];
        }

        const status = row.status ?? 'pending';
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        const {icon, tagType} = tagPriority[status] ?? {};

        return [
          <td key="task">{onboardingTask.title}</td>,
          <td key="status">
            <Tag icon={icon} variant={tagType}>
              {status}
            </Tag>
          </td>,
          <td key="date">{completed && moment(completed).fromNow()}</td>,
        ];
      }}
      {...props}
    />
  );
}

export default CustomerOnboardingTasks;
