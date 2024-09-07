import {useContext} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import InfoTooltip from 'sentry/components/infoTooltip';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Panel from 'sentry/components/panels/panel';
import {FormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SavedSearch} from 'sentry/types/group';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {NewTabContext} from 'sentry/views/issueList/utils/newTabContext';

type SearchSuggestion = {
  label: string;
  query: string;
};

interface SearchSuggestionListProps {
  searchSuggestions: SearchSuggestion[];
  title: React.ReactNode;
}

const RECOMMENDED_SEARCHES: SearchSuggestion[] = [
  {label: 'Assigned to Me', query: 'assigned:me'},
  {label: 'My Bookmarks', query: 'bookmarks:me'},
  {label: 'Errors Only', query: 'status:unresolved level:error'},
  {
    label: 'Unhandled',
    query: 'status:unresolved error.unhandled:True',
  },
];

// These saved searches are filtered down to those with visibility="owner". Ideally, we'd
// include those created by the user, but have visibility="orga"
function AddViewPage({savedSearches}: {savedSearches: SavedSearch[]}) {
  const savedSearchTitle = (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        gap: space(1),
        lineHeight: 1,
        marginBottom: 6,
      }}
    >
      {t('Saved Searches (will be deprecated)')}
      <InfoTooltip
        title={
          'Saved searches will be deprecated soon. For any you wish to return to, please save them as views.'
        }
        size="sm"
        position="top"
        color="subText"
        hoverAnimation={false}
      />
    </div>
  );

  return (
    <AddViewWrapper>
      <StyledPanel>
        <Title>{t('Find what you need, faster')}</Title>
        <SubTitle>
          {t(
            "Save your issue searches for quick access. Views are for your eyes only – no need to worry about messing up other team members' views."
          )}
        </SubTitle>
        <FeedbackButton />
      </StyledPanel>
      <SearchSuggestionList
        title={'Recommended Searches'}
        searchSuggestions={RECOMMENDED_SEARCHES}
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
        />
      )}
    </AddViewWrapper>
  );
}

function SearchSuggestionList({title, searchSuggestions}: SearchSuggestionListProps) {
  const {onNewViewSaved} = useContext(NewTabContext);

  return (
    <SuggestionList>
      <TitleWrapper>{title}</TitleWrapper>
      {searchSuggestions.map((suggestion, index) => (
        <Suggestion
          key={index}
          onClick={() => onNewViewSaved?.(suggestion.label, suggestion.query)}
        >
          <div style={{marginLeft: 10}}>{suggestion.label}</div>
          <QueryWrapper>
            <FormattedQuery query={suggestion.query} />
            {
              <ActionsWrapper>
                <StyledButton
                  size="zero"
                  onClick={e => {
                    e.stopPropagation();
                    onNewViewSaved?.(suggestion.label, suggestion.query);
                  }}
                  borderless
                >
                  {t('Save as new view')}
                </StyledButton>
              </ActionsWrapper>
            }
          </QueryWrapper>
          <InteractionStateLayer />
        </Suggestion>
      ))}
    </SuggestionList>
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
    >
      {t('Give Feedback')}
    </Button>
  );
}

export default AddViewPage;

const TitleWrapper = styled('div')`
  color: ${p => p.theme.subText};
  font-weight: 550;
  font-size: ${p => p.theme.fontSizeMedium};
  margin-bottom: ${space(0.75)};
`;

// const Pipe = styled('div')`
//   color: ${p => p.theme.gray200};
// `;

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
  margin-right: ${space(1.5)};

  &:hover {
    color: ${p => p.theme.subText};
  }
`;

const QueryWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const Suggestion = styled('li')`
  position: relative;
  display: inline-grid;
  grid-template-columns: 150px auto;
  align-items: center;
  padding: ${space(1)} 0;
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  border-radius: 4px;

  &:hover {
    cursor: pointer;
  }

  &:hover ${ActionsWrapper} {
    visibility: visible;
  }
`;

const SuggestionList = styled('ul')`
  display: flex;
  flex-direction: column;
  padding: 0;
`;

const StyledPanel = styled(Panel)`
  display: inline-flex;
  flex-direction: column;
  margin-bottom: 0;
  padding: 12px;
  gap: ${space(0.5)};
  border: 1px solid ${p => p.theme.border};

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
  margin: 0;
`;

const AddViewWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  border: 0;
  gap: ${space(2)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: column;
    align-items: center;
    padding: ${space(3)};
    text-align: center;
  }
`;
