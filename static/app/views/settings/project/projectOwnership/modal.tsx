import {Fragment} from 'react';
import styled from '@emotion/styled';

import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event, Frame} from 'sentry/types/event';
import type {TagWithTopValues} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {uniq} from 'sentry/utils/array/uniq';
import {safeURL} from 'sentry/utils/url/safeURL';
import {useUser} from 'sentry/utils/useUser';
import OwnerInput from 'sentry/views/settings/project/projectOwnership/ownerInput';

type IssueOwnershipResponse = {
  autoAssignment: boolean;
  dateCreated: string;
  fallthrough: boolean;
  isActive: boolean;
  lastUpdated: string;
  raw: string;
};

type Props = DeprecatedAsyncComponent['props'] & {
  issueId: string;
  onCancel: () => void;
  organization: Organization;
  project: Project;
  eventData?: Event;
};

type State = {
  ownership: null | IssueOwnershipResponse;
  urlTagData: null | TagWithTopValues;
} & DeprecatedAsyncComponent['state'];

function getFrameSuggestions(eventData?: Event) {
  // pull frame data out of exception or the stacktrace
  const entry = eventData?.entries?.find(({type}) =>
    ['exception', 'stacktrace'].includes(type)
  );

  let frames: Frame[] = [];
  if (entry?.type === 'exception') {
    frames = entry?.data?.values?.[0]?.stacktrace?.frames ?? [];
  } else if (entry?.type === 'stacktrace') {
    frames = entry?.data?.frames ?? [];
  }

  // Only display in-app frames
  frames = frames.filter(frame => frame?.inApp).reverse();

  return uniq(frames.map(frame => frame.filename || frame.absPath || ''));
}

/**
 * Attempt to remove the origin from a URL
 */
function getUrlPath(maybeUrl?: string) {
  if (!maybeUrl) {
    return '';
  }

  const parsedURL = safeURL(maybeUrl);
  if (!parsedURL) {
    return maybeUrl;
  }

  return `*${parsedURL.pathname}`;
}

function OwnershipSuggestions({
  paths,
  urls,
  eventData,
}: {
  paths: string[];
  urls: string[];
  eventData?: Event;
}) {
  const user = useUser();
  if (!user.email) {
    return null;
  }

  const pathSuggestion = paths.length ? `path:${paths[0]} ${user.email}` : null;
  const urlSuggestion = urls.length ? `url:${getUrlPath(urls[0])} ${user.email}` : null;

  const transactionTag = eventData?.tags?.find(({key}) => key === 'transaction');
  const transactionSuggestion = transactionTag
    ? `tags.transaction:${transactionTag.value} ${user.email}`
    : null;

  return (
    <StyledPre>
      # {t('Here’s some suggestions based on this issue')}
      <br />
      {[pathSuggestion, urlSuggestion, transactionSuggestion]
        .filter(x => x)
        .map(suggestion => (
          <Fragment key={suggestion}>
            {suggestion}
            <br />
          </Fragment>
        ))}
    </StyledPre>
  );
}

class ProjectOwnershipModal extends DeprecatedAsyncComponent<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization, project, issueId} = this.props;
    return [
      ['ownership', `/projects/${organization.slug}/${project.slug}/ownership/`],
      [
        'urlTagData',
        `/issues/${issueId}/tags/url/`,
        {},
        {
          allowError: (
            error: any // Allow for 404s
          ) => error.status === 404,
        },
      ],
    ];
  }

  renderBody() {
    const {ownership, urlTagData} = this.state;
    const {eventData, organization, project, onCancel} = this.props;
    if (!ownership) {
      return null;
    }

    const urls = urlTagData
      ? urlTagData.topValues
          .sort((a, b) => a.count - b.count)
          .map(i => i.value)
          .slice(0, 5)
      : [];
    const paths = getFrameSuggestions(eventData);

    return (
      <Fragment>
        <Fragment>
          <Description>
            {tct(
              'Assign issues based on custom rules. To learn more, [docs:read the docs].',
              {
                docs: (
                  <ExternalLink href="https://docs.sentry.io/product/issues/issue-owners/" />
                ),
              }
            )}
          </Description>
          <OwnershipSuggestions paths={paths} urls={urls} eventData={eventData} />
        </Fragment>
        <OwnerInput
          organization={organization}
          project={project}
          initialText={ownership?.raw || ''}
          urls={urls}
          paths={paths}
          dateUpdated={ownership.lastUpdated}
          onCancel={onCancel}
          page="issue_details"
        />
      </Fragment>
    );
  }
}

const Description = styled('p')`
  margin-bottom: ${space(1)};
`;

const StyledPre = styled('pre')`
  word-break: break-word;
  padding: ${space(2)};
  line-height: 1.6;
  color: ${p => p.theme.subText};
`;

export default ProjectOwnershipModal;
