import styled from '@emotion/styled';
import {Location} from 'history';

import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import {Event} from 'app/types/event';

import EventTags from '../eventTags/eventTags';

import DataSection from './dataSection';
import TagsHighlight from './tagsHighlight';

type Props = {
  event: Event;
  organization: Organization;
  projectSlug: Project['slug'];
  location: Location;
  hasQueryFeature: boolean;
};

function Tags({event, organization, projectSlug, location, hasQueryFeature}: Props) {
  return (
    <StyledDataSection title={t('Tags')} description={t('This is a temp description')}>
      <TagsHighlight event={event} />
      <EventTags
        event={event}
        organization={organization}
        projectId={projectSlug}
        location={location}
        hasQueryFeature={hasQueryFeature}
      />
    </StyledDataSection>
  );
}

export default Tags;

const StyledDataSection = styled(DataSection)`
  overflow: hidden;
`;
