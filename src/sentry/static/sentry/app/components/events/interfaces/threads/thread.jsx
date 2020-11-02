import isNil from 'lodash/isNil';
import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import CrashContent from 'app/components/events/interfaces/crashContent';
import Pills from 'app/components/pills';
import Pill from 'app/components/pill';

class Thread extends React.Component {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
    projectId: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
    stackView: PropTypes.string,
    stackType: PropTypes.string,
    newestFirst: PropTypes.bool,
    exception: PropTypes.object,
    stacktrace: PropTypes.object,
  };

  render() {
    const {
      data,
      event,
      projectId,
      stackView,
      stackType,
      newestFirst,
      exception,
      stacktrace,
    } = this.props;

    const renderPills = !isNil(data.id) || !!data.name;
    const hasMissingStacktrace = !(exception || stacktrace);

    return (
      <div className="thread">
        {renderPills && (
          <Pills>
            <Pill name={t('id')} value={data.id} />
            <Pill name={t('name')} value={data.name} />
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
                  <span className="informal">
                    {data.crashed
                      ? t('Thread Errored')
                      : t('No or unknown stacktrace')}
                  </span>
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
  }
}

export default Thread;
