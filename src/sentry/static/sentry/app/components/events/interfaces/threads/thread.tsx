import React from 'react';
import isNil from 'lodash/isNil';

import {t} from 'app/locale';
import {Event, Project} from 'app/types';
import {STACK_TYPE, STACK_VIEW} from 'app/types/stacktrace';
import CrashContent from 'app/components/events/interfaces/crashContent';
import Pills from 'app/components/pills';
import Pill from 'app/components/pill';
import {ThreadType} from 'app/types/events';

type CrashContentProps = React.ComponentProps<typeof CrashContent>;

type Props = {
  event: Event;
  projectId: Project['id'];
  data: ThreadType;
  stackView: STACK_VIEW;
  stackType: STACK_TYPE;
  newestFirst: boolean;
} & Pick<CrashContentProps, 'exception' | 'stacktrace'>;

const Thread = ({
  event,
  projectId,
  data,
  stackView,
  stackType,
  newestFirst,
  exception,
  stacktrace,
}: Props) => {
  const renderPills = !isNil(data.id) || !!data.name;
  const hasMissingStacktrace = !(exception || stacktrace);

  return (
    <div className="thread">
      {renderPills && (
        <Pills>
          {!isNil(data.id) && <Pill name={t('id')} value={String(data.id)} />}
          {!!data.name?.trim() && <Pill name={t('name')} value={data.name} />}
          <Pill name={t('was active')} value={data.current} />
          <Pill name={t('errored')} className={data.crashed ? 'false' : 'true'}>
            {data.crashed ? t('yes') : t('no')}
          </Pill>
        </Pills>
      )}

      {hasMissingStacktrace ? (
        <div className="traceback missing-traceback">
          <ul>
            <li className="frame missing-frame">
              <div className="title">
                <i>
                  {data.crashed ? t('Thread Errored') : t('No or unknown stacktrace')}
                </i>
              </div>
            </li>
          </ul>
        </div>
      ) : (
        <CrashContent
          event={event}
          stackType={stackType}
          stackView={stackView}
          newestFirst={newestFirst}
          projectId={projectId}
          exception={exception}
          stacktrace={stacktrace}
        />
      )}
    </div>
  );
};

export default Thread;
