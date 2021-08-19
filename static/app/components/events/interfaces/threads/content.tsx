import * as React from 'react';
import isNil from 'lodash/isNil';

import CrashContent from 'app/components/events/interfaces/crashContent';
import Pill from 'app/components/pill';
import Pills from 'app/components/pills';
import {t} from 'app/locale';
import {Project} from 'app/types';
import {Event} from 'app/types/event';
import {Thread} from 'app/types/events';
import {STACK_TYPE, STACK_VIEW} from 'app/types/stacktrace';

import NoStackTraceMessage from '../noStackTraceMessage';

type CrashContentProps = React.ComponentProps<typeof CrashContent>;

type Props = {
  event: Event;
  projectId: Project['id'];
  stackType: STACK_TYPE;
  newestFirst: boolean;
  stackTraceNotFound: boolean;
  stackView?: STACK_VIEW;
  data?: Thread;
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
