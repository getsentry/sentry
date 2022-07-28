import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {SectionContents} from 'sentry/components/events/eventDataSection';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import type {Organization, Project} from 'sentry/types';
import type {Event} from 'sentry/types/event';
import {objectIsEmpty} from 'sentry/utils';

import EventTags from '../eventTags/eventTags';

import DataSection from './dataSection';
import TagsHighlight from './tagsHighlight';

type Props = {
  event: Event;
  hasContext: boolean;
  location: Location;
  organization: Organization;
  projectSlug: Project['slug'];
};

function Tags({event, organization, projectSlug, location, hasContext}: Props) {
  // Check for context bailout condition. No context is rendered if only user is provided
  const hasEventContext = !objectIsEmpty(event.contexts);

  return (
    <div>
      {hasContext && hasEventContext && (
        <Fragment>
          <TagsHighlightWrapper>
            <TagsHighlight event={event} />
          </TagsHighlightWrapper>
          <Divider />
        </Fragment>
      )}
      <StyledDataSection
        title={t('Tags')}
        description={t(
          'Tags help you quickly both access related events and view the tag distribution for a set of events'
        )}
        data-test-id="event-tags"
      >
        <EventTags
          event={event}
          organization={organization}
          projectId={projectSlug}
          location={location}
        />
      </StyledDataSection>
    </div>
  );
}

export default Tags;

const TagsHighlightWrapper = styled('div')`
  padding: 0 ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    padding: 0 ${space(4)};
  }
`;

const StyledDataSection = styled(DataSection)`
  border-top: 0;
  overflow: hidden;
  ${SectionContents} {
    overflow: hidden;
  }
`;

const Divider = styled('div')`
  height: 1px;
  width: 100%;
  background: ${p => p.theme.innerBorder};
`;
