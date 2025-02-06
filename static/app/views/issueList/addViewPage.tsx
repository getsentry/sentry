import {useContext} from 'react';
import styled from '@emotion/styled';

import bannerStar from 'sentry-images/spot/banner-star.svg';

import {usePrompt} from 'sentry/actionCreators/prompts';
import {Button, LinkButton} from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import ExternalLink from 'sentry/components/links/externalLink';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {FormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {IconClose} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SavedSearch} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getFieldDefinition} from 'sentry/utils/fields';
import useOrganization from 'sentry/utils/useOrganization';
import {OverflowEllipsisTextContainer} from 'sentry/views/insights/common/components/textAlign';
import {NewTabContext} from 'sentry/views/issueList/utils/newTabContext';
import {useIssueListFilterKeys} from 'sentry/views/issueList/utils/useIssueListFilterKeys';

type SearchSuggestion = {
  label: string;
  query: string;
  scope?: 'personal' | 'organization';
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

function AddViewPage({
  personalSavedSearches = [],
  organizationSavedSearches = [],
}: {
  organizationSavedSearches?: SavedSearch[];
  personalSavedSearches?: SavedSearch[];
}) {
  const toolTipContents = (
    <Container>
      {t(
        'Saved searches will be deprecated soon. For any you wish to return to, please save them as views.'
      )}
      <ExternalLink href={'https://docs.sentry.io/product/issues/issue-views'}>
        {t('Learn More')}
      </ExternalLink>
    </Container>
  );

  const savedSearchTitle = (
    <SavedSearchesTitle>
      {t('Saved Searches (will be removed)')}
      <QuestionTooltip
        icon="info"
        title={toolTipContents}
        size="sm"
        position="top"
        skipWrapper
        isHoverable
      />
    </SavedSearchesTitle>
  );

  const savedSearchSuggestions: SearchSuggestion[] = [
    ...(personalSavedSearches.map(search => ({
      label: search.name,
      query: search.query,
      scope: 'personal',
    })) as SearchSuggestion[]),
    ...(organizationSavedSearches.map(search => ({
      label: search.name,
      query: search.query,
      scope: 'organization',
    })) as SearchSuggestion[]),
  ];

  return (
    <AddViewWrapper>
      <AddViewBanner
        hasSavedSearches={savedSearchSuggestions && savedSearchSuggestions.length !== 0}
      />
      <SearchSuggestionList
        title={'Recommended Searches'}
        searchSuggestions={RECOMMENDED_SEARCHES}
        type="recommended"
      />
      {savedSearchSuggestions.length !== 0 && (
        <SearchSuggestionList
          title={savedSearchTitle}
          searchSuggestions={savedSearchSuggestions}
          type="saved_searches"
        />
      )}
    </AddViewWrapper>
  );
}

function AddViewBanner({hasSavedSearches}: {hasSavedSearches: boolean}) {
  const organization = useOrganization();

  const {isPromptDismissed, dismissPrompt} = usePrompt({
    feature: 'issue_views_add_view_banner',
    organization,
  });

  return !isPromptDismissed ? (
    <Banner>
      <BannerStar1 src={bannerStar} />
      <BannerStar2 src={bannerStar} />
      <BannerStar3 src={bannerStar} />
      <Title>
        {t('Welcome to the new Issue Views experience (Early Adopter only)')}
        <DismissButton
          analyticsEventKey="issue_views.add_view.banner_dismissed"
          analyticsEventName="'Issue Views: Add View Banner Dismissed"
          size="zero"
          borderless
          icon={<IconClose size="xs" />}
          aria-label={t('Dismiss')}
          onClick={() => dismissPrompt()}
        />
      </Title>
      <SubTitle>
        <div>
          {t(
            'Issues just got a lot more personalized. Save your frequent issue searches for quick access.'
          )}
        </div>
        <div>{t('A few notes before you get started:')}</div>
        <AFewNotesList>
          <li>
            <BannerNoteBold>{t('Views are for your eyes only. ')}</BannerNoteBold>
            {t("No need to worry about messing up other team members' views")}
          </li>
          <li>
            <BannerNoteBold>{t('Drag your views to reorder. ')}</BannerNoteBold>{' '}
            {t('The leftmost view is your “default” experience')}
          </li>
          {hasSavedSearches && (
            <li>
              <BannerNoteBold>
                {t('Saved searches will be deprecated in the future. ')}
              </BannerNoteBold>{' '}
              {t(
                'You can save them as views from the list below (only appears if you have saved searches)'
              )}
            </li>
          )}
        </AFewNotesList>
      </SubTitle>
      <FittedLinkButton
        size="sm"
        href="https://docs.sentry.io/product/issues/issue-views"
        external
      >
        {t('Read Docs')}
      </FittedLinkButton>
    </Banner>
  ) : null;
}

function SearchSuggestionList({
  title,
  searchSuggestions,
  type,
}: SearchSuggestionListProps) {
  const {onNewViewsSaved} = useContext(NewTabContext);
  const organization = useOrganization();

  const analyticsKey =
    type === 'recommended'
      ? 'issue_views.add_view.recommended_view_saved'
      : 'issue_views.add_view.saved_search_saved';
  const analyticsEventName =
    type === 'recommended'
      ? 'Issue Views: Recommended View Saved'
      : 'Issue Views: Saved Search Saved';

  const filterKeys = useIssueListFilterKeys();

  return (
    <Suggestions>
      <TitleWrapper>
        {title}
        {type === 'saved_searches' && (
          <StyledButton
            size="zero"
            onClick={e => {
              e.stopPropagation();
              openConfirmModal({
                message: (
                  <ConfirmModalMessage>
                    {tn(
                      'Save %s saved search as a view?',
                      'Save %s saved searches as views?',
                      searchSuggestions.length
                    )}
                  </ConfirmModalMessage>
                ),
                onConfirm: () => {
                  onNewViewsSaved?.(
                    searchSuggestions.map(suggestion => ({
                      ...suggestion,
                      saveQueryToView: true,
                    }))
                  );
                },
              });
            }}
            analyticsEventKey="issue_views.add_view.all_saved_searches_saved"
            analyticsEventName="Issue Views: All Saved Searches Saved"
            borderless
          >
            {t('Save all')}
          </StyledButton>
        )}
      </TitleWrapper>
      <SuggestionList>
        {searchSuggestions.map((suggestion, index) => (
          <Suggestion
            key={index}
            onClick={() => {
              onNewViewsSaved?.([
                {
                  ...suggestion,
                  saveQueryToView: false,
                },
              ]);
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
            <OverflowEllipsisTextContainer>
              {suggestion.label}
            </OverflowEllipsisTextContainer>
            <ScopeTagContainer>
              {suggestion.scope === 'personal' ? (
                <Scope>{t('Private')}</Scope>
              ) : suggestion.scope === 'organization' ? (
                <Scope>{t('Public')}</Scope>
              ) : null}
            </ScopeTagContainer>
            <QueryWrapper>
              <FormattedQuery
                query={suggestion.query}
                fieldDefinitionGetter={getFieldDefinition}
                filterKeys={filterKeys}
              />
              <ActionsWrapper className="data-actions-wrapper">
                <StyledButton
                  size="zero"
                  onClick={e => {
                    e.stopPropagation();
                    onNewViewsSaved?.([
                      {
                        ...suggestion,
                        saveQueryToView: true,
                      },
                    ]);
                  }}
                  analyticsEventKey={analyticsKey}
                  analyticsEventName={analyticsEventName}
                  analyticsParams={{
                    persisted: true,
                    label: suggestion.label,
                    query: suggestion.query,
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

export default AddViewPage;

const Scope = styled('div')`
  color: ${p => p.theme.subText};
`;

const ScopeTagContainer = styled('div')`
  display: flex;
`;

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

const TitleWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
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

  li:last-child {
    border-bottom: 1px solid transparent;
  }
`;

const Suggestion = styled('li')`
  position: relative;
  display: inline-grid;
  grid-template-columns: 170px 60px auto;
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
  border-radius: ${p => p.theme.borderRadius};

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

const BannerNoteBold = styled('div')`
  display: inline;
  font-weight: ${p => p.theme.fontWeightBold};
`;

const SubTitle = styled('div')`
  display: flex;
  flex-direction: column;
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeMedium};
  gap: ${space(0.5)};
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

const ConfirmModalMessage = styled('div')`
  display: flex;
  justify-content: center;
  font-weight: ${p => p.theme.fontWeightBold};
`;

const Container = styled('div')`
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  gap: ${space(1)};
`;

const AFewNotesList = styled('ul')`
  margin-bottom: ${space(0.5)};
`;

const FittedLinkButton = styled(LinkButton)`
  width: fit-content;
`;

const DismissButton = styled(Button)`
  position: absolute;
  top: ${space(1)};
  right: ${space(1)};
  color: ${p => p.theme.subText};
`;
