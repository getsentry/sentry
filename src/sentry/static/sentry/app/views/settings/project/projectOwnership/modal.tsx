import React from 'react';
import uniq from 'lodash/uniq';
import {WithRouterProps} from 'react-router';

import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import OwnerInput from 'app/views/settings/project/projectOwnership/ownerInput';
import {
  Organization,
  Project,
  SentryErrorEvent,
  TagWithTopValues,
  Entry,
  Frame,
} from 'app/types';

type IssueOwnershipResponse = {
  raw: string;
  fallthrough: boolean;
  dateCreated: string;
  lastUpdated: string;
  isActive: boolean;
  autoAssignment: boolean;
};

type Props = {
  organization: Organization;
  project: Project;
  issueId: string;
  onSave: () => void;
} & WithRouterProps<{orgId: string; projectId: string; issueId: string}, {}>;

type State = {
  ownership: null | IssueOwnershipResponse;
  eventData: null | SentryErrorEvent;
  urlTagData: null | TagWithTopValues;
} & AsyncComponent['state'];

class ProjectOwnershipModal extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, project, issueId} = this.props;
    return [
      ['ownership', `/projects/${organization.slug}/${project.slug}/ownership/`],
      [
        'urlTagData',
        `/issues/${issueId}/tags/url/`,
        {},
        {
          allowError: error =>
            // Allow for 404s
            error.status === 404,
        },
      ],
      ['eventData', `/issues/${issueId}/events/latest/`],
    ];
  }

  renderBody() {
    const {ownership, urlTagData, eventData} = this.state;
    if (!ownership || !urlTagData || !eventData) {
      return null;
    }
    const urls = urlTagData
      ? urlTagData.topValues
          .sort((a, b) => a.count - b.count)
          .map(i => i.value)
          .slice(0, 5)
      : [];

    // pull frame data out of exception or the stacktrace
    const entry = (eventData.entries as Entry[]).find(({type}) =>
      ['exception', 'stacktrace'].includes(type)
    );

    let frames: Frame[] = [];
    if (entry?.type === 'exception') {
      frames = entry?.data?.values?.[0]?.stacktrace?.frames ?? [];
    }
    if (entry?.type === 'stacktrace') {
      frames = entry?.data?.frames ?? [];
    }

    // filter frames by inApp unless there would be 0
    const inAppFrames = frames.filter(frame => frame.inApp);
    if (inAppFrames.length > 0) {
      frames = inAppFrames;
    }

    const paths = uniq(frames.map(frame => frame.filename || frame.absPath || ''))
      .filter(i => i)
      .slice(0, 30);

    return (
      <React.Fragment>
        <p>{t('Match against Issue Data: (globbing syntax *, ? supported)')}</p>
        <OwnerInput
          {...this.props}
          initialText={ownership.raw || ''}
          urls={urls}
          paths={paths}
        />
      </React.Fragment>
    );
  }
}

export default ProjectOwnershipModal;
