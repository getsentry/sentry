import {BookmarkStar} from 'sentry/components/projects/bookmarkStar';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

interface ProjectStarToggleProps {
  organization: Organization;
  project: Project;
}

/**
 * A star toggle for a project row inside a dropdown menu.
 *
 * Menu rows render their trailing items inside the row's link, and the menu
 * itself acts on Enter/Space, so the toggle has to keep its own events from
 * bubbling — otherwise starring a project would navigate to it or close the
 * menu. `BookmarkStar` spreads its props after its own `onClick`, so the
 * interception happens on this wrapper rather than on the button.
 */
export function ProjectStarToggle({organization, project}: ProjectStarToggleProps) {
  return (
    <div
      onClick={event => {
        // Stop the enclosing link from navigating.
        event.preventDefault();
        event.stopPropagation();
      }}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.stopPropagation();
        }
      }}
    >
      <BookmarkStar organization={organization} project={project} />
    </div>
  );
}
