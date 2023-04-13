import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {Event, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
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
  const config = useLegacyStore(ConfigStore);
  const [showDetails, setShowDetails] = useState(true);
  const [openSuggestion, setOpenSuggestion] = useState(false);

  if (!organization.features.includes('open-ai-suggestion-new-design')) {
    return null;
  }

  const darkMode = config.theme === 'dark';

  return (
    <StyledEventDataSection
      type="ai-suggested-solution"
      guideTarget="ai-suggested-solution"
      title={t('Resources and Maybe Solutions')}
      help={tct(
        'This is an OpenAI generated solution that suggests a fix for this issue. Be aware that this may not be accurate. [learnMore:Learn more]',
        {
          learnMore: (
            <ExternalLink href="https://docs.sentry.io/product/issues/issue-details/suggested-fix/" />
          ),
        }
      )}
      isHelpHoverable
      actions={
        <ToggleButton
          onClick={() => {
            setShowDetails(!showDetails);
          }}
          priority="link"
        >
          {showDetails ? t('Hide Details') : t('Show Details')}
        </ToggleButton>
      }
    >
      {showDetails ? (
        !openSuggestion ? (
          <Banner
            darkMode={darkMode}
            onViewSuggestion={() => {
              trackAdvancedAnalyticsEvent(
                'ai_suggested_solution.view_suggestion_button_clicked',
                {
                  organization,
                  project_id: event.projectID,
                  group_id: event.groupID,
                  ...getAnalyticsDataForEvent(event),
                }
              );
              setOpenSuggestion(true);
            }}
          />
        ) : (
          <Suggestion
            darkMode={darkMode}
            projectSlug={projectSlug}
            event={event}
            onHideSuggestion={() => {
              trackAdvancedAnalyticsEvent(
                'ai_suggested_solution.hide_suggestion_button_clicked',
                {
                  organization,
                  project_id: event.projectID,
                  group_id: event.groupID,
                  ...getAnalyticsDataForEvent(event),
                }
              );
              setOpenSuggestion(false);
            }}
          />
        )
      ) : null}
    </StyledEventDataSection>
  );
}

const ToggleButton = styled(Button)`
  font-weight: 700;
  color: ${p => p.theme.subText};
  &:hover,
  &:focus {
    color: ${p => p.theme.textColor};
  }
`;

const StyledEventDataSection = styled(EventDataSection)`
  > *:first-child {
    z-index: 1;
  }
`;
