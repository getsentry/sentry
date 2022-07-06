import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import flatMap from 'lodash/flatMap';
import uniqBy from 'lodash/uniqBy';

import {CommitRow} from 'sentry/components/commitRow';
import {CauseHeader, DataSection} from 'sentry/components/events/styles';
import {Panel} from 'sentry/components/panels';
import {IconAdd, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import type {AvatarProject, Group} from 'sentry/types';
import type {Event} from 'sentry/types/event';
import useCommitters from 'sentry/utils/useCommitters';

interface Props {
  event: Event;
  project: AvatarProject;
  group?: Group;
}

function EventCause({group, event, project}: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const {committers} = useCommitters({
    group,
    eventId: event.id,
    projectSlug: project.slug,
  });

  function getUniqueCommitsWithAuthors() {
    // Get a list of commits with author information attached
    const commitsWithAuthors = flatMap(committers, ({commits, author}) =>
      commits.map(commit => ({
        ...commit,
        author,
      }))
    );

    // Remove duplicate commits
    return uniqBy(commitsWithAuthors, commit => commit.id);
  }

  if (!committers.length) {
    return null;
  }

  const commits = getUniqueCommitsWithAuthors();

  return (
    <DataSection>
      <CauseHeader>
        <h3 data-test-id="event-cause">
          {t('Suspect Commits')} ({commits.length})
        </h3>
        {commits.length > 1 && (
          <ExpandButton onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? (
              <Fragment>
                {t('Show less')} <IconSubtract isCircled size="md" />
              </Fragment>
            ) : (
              <Fragment>
                {t('Show more')} <IconAdd isCircled size="md" />
              </Fragment>
            )}
          </ExpandButton>
        )}
      </CauseHeader>
      <Panel>
        {commits.slice(0, isExpanded ? 100 : 1).map(commit => (
          <CommitRow key={commit.id} commit={commit} />
        ))}
      </Panel>
    </DataSection>
  );
}

const ExpandButton = styled('button')`
  display: flex;
  align-items: center;
  & > svg {
    margin-left: ${space(0.5)};
  }
`;

export default EventCause;
