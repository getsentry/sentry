import {useState} from 'react';

import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getAnalyticsDataForEvent} from 'sentry/utils/events';
import useOrganization from 'sentry/utils/useOrganization';

import {Banner} from './banner';
import {Suggestion} from './suggestion';

type Props = {
  event: Event;
  projectSlug: Project['slug'];
};

export function AiSuggestedSolution({projectSlug, event}: Props) {
  const organization = useOrganization();

  const [openSuggestion, setOpenSuggestion] = useState(false);

  return (
    <div>
      {!openSuggestion ? (
        <Banner
          onViewSuggestion={() => {
            trackAnalytics('ai_suggested_solution.view_suggestion_button_clicked', {
              organization,
              project_id: event.projectID,
              group_id: event.groupID,
              ...getAnalyticsDataForEvent(event),
            });
            setOpenSuggestion(true);
          }}
        />
      ) : (
        <Suggestion
          projectSlug={projectSlug}
          event={event}
          onHideSuggestion={() => {
            trackAnalytics('ai_suggested_solution.hide_suggestion_button_clicked', {
              organization,
              project_id: event.projectID,
              group_id: event.groupID,
              ...getAnalyticsDataForEvent(event),
            });
            setOpenSuggestion(false);
          }}
        />
      )}
    </div>
  );
}
