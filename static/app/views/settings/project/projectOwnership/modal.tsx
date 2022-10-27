import {Fragment} from 'react';
import uniq from 'lodash/uniq';

import AsyncComponent from 'sentry/components/asyncComponent';
import {t} from 'sentry/locale';
import {Frame, Organization, Project, TagWithTopValues} from 'sentry/types';
import {Entry, EventError} from 'sentry/types/event';
import OwnerInput from 'sentry/views/settings/project/projectOwnership/ownerInput';

type IssueOwnershipResponse = {
  autoAssignment: boolean;
  dateCreated: string;
  fallthrough: boolean;
  isActive: boolean;
  lastUpdated: string;
  raw: string;
};

type Props = AsyncComponent['props'] & {
  issueId: string;
  onSave: () => void;
  organization: Organization;
  project: Project;
};

type State = {
  eventData: null | EventError;
  ownership: null | IssueOwnershipResponse;
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
    if (!ownership && !urlTagData && !eventData) {
      return null;
    }
    const urls = urlTagData
      ? urlTagData.topValues
          .sort((a, b) => a.count - b.count)
          .map(i => i.value)
          .slice(0, 5)
      : [];

    // pull frame data out of exception or the stacktrace
    const entry = (eventData?.entries as Entry[])?.find(({type}) =>
      ['exception', 'stacktrace'].includes(type)
    );

    let frames: Frame[] = [];
    if (entry?.type === 'exception') {
      frames = entry?.data?.values?.[0]?.stacktrace?.frames ?? [];
    }
    if (entry?.type === 'stacktrace') {
      frames = entry?.data?.frames ?? [];
    }

    // Only display in-app frames
    frames = frames.filter(frame => frame.inApp);

    const paths = uniq(frames.map(frame => frame.filename || frame.absPath || ''))
      .filter(i => i)
      .slice(0, 30);

    return (
      <Fragment>
        <p>{t('Match against Issue Data: (globbing syntax *, ? supported)')}</p>
        <OwnerInput
          {...this.props}
          initialText={ownership?.raw || ''}
          urls={urls}
          paths={paths}
        />
      </Fragment>
    );
  }
}

export default ProjectOwnershipModal;
