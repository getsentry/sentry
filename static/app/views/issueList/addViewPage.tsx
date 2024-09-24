import {useContext} from 'react';
import styled from '@emotion/styled';

import bannerStar from 'sentry-images/spot/banner-star.svg';

import {Button} from 'sentry/components/button';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {FormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SavedSearch} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import useOrganization from 'sentry/utils/useOrganization';
import {OverflowEllipsisTextContainer} from 'sentry/views/insights/common/components/textAlign';
import {NewTabContext} from 'sentry/views/issueList/utils/newTabContext';

type SearchSuggestion = {
  label: string;
  query: string;
};

interface SearchSuggestionListProps {
  searchSuggestions: SearchSuggestion[];
  title: React.ReactNode;
  type: 'recommended' | 'saved_searches';
}

const RECOMMENDED_SEARCHES: SearchSuggestion[] = [
  {label: 'Prioritized', query: 'is:unresolved issue.priority:[high, medium]'},
  {label: 'Assigned to Me', query: 'is:unresolved assigned_or_suggested:me'},
  {
    label: 'For Review',
    query: 'is:unresolved is:for_review assigned_or_suggested:[me, my_teams, none]',
  },
  {label: 'Request Errors', query: 'is:unresolved http.status_code:5*'},
  {label: 'High Volume Issues', query: 'is:unresolved timesSeen:>100'},
  {label: 'Recent Errors', query: 'is:unresolved issue.category:error firstSeen:-24h'},
  {label: 'Function Regressions', query: 'issue.type:profile_function_regression'},
];

function AddViewPage({savedSearches}: {savedSearches: SavedSearch[]}) {
  const savedSearchTitle = (
    <SavedSearchesTitle>
      {t('Saved Searches (will be deprecated)')}
      <QuestionTooltip
        icon="info"
        title={t(
          'Saved searches will be deprecated soon. For any you wish to return to, please save them as views.'
        )}
        size="sm"
        position="top"
        skipWrapper
      />
    </SavedSearchesTitle>
  );

  return (
    <AddViewWrapper>
      <Banner>
        <BannerStar1 src={bannerStar} />
        <BannerStar2 src={bannerStar} />
        <BannerStar3 src={bannerStar} />
        <Title>{t('Find what you need, faster')}</Title>
        <SubTitle>
          {t(
            "Save your issue searches for quick access. Views are for your eyes only – no need to worry about messing up other team members' views."
          )}
        </SubTitle>
        <FeedbackButton />
      </Banner>
      <SearchSuggestionList
        title={'Recommended Searches'}
        searchSuggestions={RECOMMENDED_SEARCHES}
        type="recommended"
      />
      {savedSearches && savedSearches.length !== 0 && (
        <SearchSuggestionList
          title={savedSearchTitle}
          searchSuggestions={savedSearches.map(search => {
            return {
              label: search.name,
              query: search.query,
            };
          })}
          type="saved_searches"
        />
      )}
    </AddViewWrapper>
  );
}

function SearchSuggestionList({
  title,
  searchSuggestions,
  type,
}: SearchSuggestionListProps) {
  const {onNewViewSaved} = useContext(NewTabContext);
  const organization = useOrganization();

  return (
    <Suggestions>
      <TitleWrapper>{title}</TitleWrapper>
      <SuggestionList>
        {searchSuggestions.map((suggestion, index) => (
          <Suggestion
            key={index}
            onClick={() => {
              onNewViewSaved?.(suggestion.label, suggestion.query, false);
              const analyticsKey =
                type === 'recommended'
                  ? 'issue_views.add_view.recommended_view_saved'
                  : 'issue_views.add_view.saved_search_saved';
              trackAnalytics(analyticsKey, {
                organization,
                persisted: false,
                label: suggestion.label,
                query: suggestion.query,
              });
            }}
          >
            {/*
            Saved search labels have an average length of approximately 16 characters
            This container fits 16 'a's comfortably, and 20 'a's before overflowing.
          */}
            <StyledOverflowEllipsisTextContainer>
              {suggestion.label}
            </StyledOverflowEllipsisTextContainer>
            <QueryWrapper>
              <FormattedQuery query={suggestion.query} />
              <ActionsWrapper className="data-actions-wrapper">
                <StyledButton
                  size="zero"
                  onClick={e => {
                    e.stopPropagation();
                    onNewViewSaved?.(suggestion.label, suggestion.query, true);
                    const analyticsKey =
                      type === 'recommended'
                        ? 'issue_views.add_view.recommended_view_saved'
                        : 'issue_views.add_view.saved_search_saved';
                    trackAnalytics(analyticsKey, {
                      organization,
                      persisted: true,
                      label: suggestion.label,
                      query: suggestion.query,
                    });
                  }}
                  borderless
                >
                  {t('Save as new view')}
                </StyledButton>
              </ActionsWrapper>
            </QueryWrapper>
            <StyledInteractionStateLayer />
          </Suggestion>
        ))}
      </SuggestionList>
    </Suggestions>
  );
}

function FeedbackButton() {
  const openForm = useFeedbackForm();

  if (!openForm) {
    return null;
  }

  return (
    <Button
      size="xs"
      icon={<IconMegaphone />}
      onClick={() =>
        openForm({
          messagePlaceholder: t('How can we make custom views better for you?'),
          tags: {
            ['feedback.source']: 'custom_views',
            ['feedback.owner']: 'issues',
          },
        })
      }
      style={{width: 'fit-content'}}
    >
      {t('Give Feedback')}
    </Button>
  );
}

export default AddViewPage;

const Suggestions = styled('section')`
  width: 100%;
`;

const SavedSearchesTitle = styled('div')`
  align-items: center;
  display: flex;
  gap: ${space(1)};
`;

const StyledInteractionStateLayer = styled(InteractionStateLayer)`
  border-radius: 4px;
  width: 100.8%;
`;

const StyledOverflowEllipsisTextContainer = styled(OverflowEllipsisTextContainer)`
  width: 170px;
`;

const TitleWrapper = styled('div')`
  color: ${p => p.theme.subText};
  font-weight: 550;
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(0.75)};
`;

const ActionsWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.75)};
  visibility: hidden;
`;

const StyledButton = styled(Button)`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightNormal};
  padding: ${space(0.5)};
  border: none;

  &:hover {
    color: ${p => p.theme.subText};
  }
`;

const QueryWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  overflow: hidden;
`;

const SuggestionList = styled('ul')`
  display: flex;
  flex-direction: column;
  padding: 0;

  li:has(+ li:hover) {
    border-bottom: 1px solid transparent;
  }

  li:hover {
    border-bottom: 1px solid transparent;
  }
`;

const Suggestion = styled('li')`
  position: relative;
  display: inline-grid;
  grid-template-columns: 170px auto;
  align-items: center;
  padding: ${space(1)} 0;
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  gap: ${space(1)};

  &:hover {
    cursor: pointer;
  }

  &:hover .data-actions-wrapper {
    visibility: visible;
  }
`;

const Banner = styled('div')`
  position: relative;
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
  padding: 12px;
  gap: ${space(0.5)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.panelBorderRadius};

  background: linear-gradient(
    269.35deg,
    ${p => p.theme.backgroundTertiary} 0.32%,
    rgba(245, 243, 247, 0) 99.69%
  );
`;
const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const SubTitle = styled('div')`
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const AddViewWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: column;
    align-items: center;
  }
`;

const BannerStar1 = styled('img')`
  position: absolute;
  bottom: 10px;
  right: 150px;
  transform: scale(0.9);

  @media (max-width: ${p => p.theme.breakpoints.large}) {
    display: none;
  }
`;
const BannerStar2 = styled('img')`
  position: absolute;
  top: 10px;
  right: 120px;
  transform: rotate(-30deg) scale(0.7);

  @media (max-width: ${p => p.theme.breakpoints.large}) {
    display: none;
  }
`;
const BannerStar3 = styled('img')`
  position: absolute;
  bottom: 30px;
  right: 80px;
  transform: rotate(80deg) scale(0.6);

  @media (max-width: ${p => p.theme.breakpoints.large}) {
    display: none;
  }
`;
