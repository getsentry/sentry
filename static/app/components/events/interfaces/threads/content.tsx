import isNil from 'lodash/isNil';

import CrashContent from 'sentry/components/events/interfaces/crashContent';
import Pill from 'sentry/components/pill';
import Pills from 'sentry/components/pills';
import {t} from 'sentry/locale';
import {Event, Project, STACK_TYPE, STACK_VIEW, Thread} from 'sentry/types';

import NoStackTraceMessage from '../noStackTraceMessage';

type CrashContentProps = React.ComponentProps<typeof CrashContent>;

type Props = {
  event: Event;
  newestFirst: boolean;
  projectId: Project['id'];
  stackTraceNotFound: boolean;
  stackType: STACK_TYPE;
  data?: Thread;
  stackView?: STACK_VIEW;
} & Pick<
  CrashContentProps,
  'exception' | 'stacktrace' | 'hasHierarchicalGrouping' | 'groupingCurrentLevel'
>;

const Content = ({
  event,
  projectId,
  data,
  stackView,
  groupingCurrentLevel,
  stackType,
  newestFirst,
  exception,
  stacktrace,
  stackTraceNotFound,
  hasHierarchicalGrouping,
}: Props) => (
  <div className="thread">
    {data && (!isNil(data?.id) || !!data?.name) && (
      <Pills>
        {!isNil(data.id) && <Pill name={t('id')} value={String(data.id)} />}
        {!!data.name?.trim() && <Pill name={t('name')} value={data.name} />}
        <Pill name={t('was active')} value={data.current} />
        <Pill name={t('errored')} className={data.crashed ? 'false' : 'true'}>
          {data.crashed ? t('yes') : t('no')}
        </Pill>
      </Pills>
    )}

    {stackTraceNotFound ? (
      <NoStackTraceMessage message={data?.crashed ? t('Thread Errored') : undefined} />
    ) : (
      <CrashContent
        event={event}
        stackType={stackType}
        stackView={stackView}
        newestFirst={newestFirst}
        projectId={projectId}
        exception={exception}
        stacktrace={stacktrace}
        groupingCurrentLevel={groupingCurrentLevel}
        hasHierarchicalGrouping={hasHierarchicalGrouping}
      />
    )}
  </div>
);

export default Content;
