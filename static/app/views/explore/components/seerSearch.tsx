import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {IconClose, IconMegaphone, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';

const SUGGESTED_SEARCHES = [
  'How many 404s did I get in the last 2 days',
  'p90 of my requests by transaction',
];

export function SeerSearch() {
  const {setSeerMode} = useSearchQueryBuilder();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const openForm = useFeedbackForm();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Handle search submission by calling Seer API
  };

  const handleFocus = () => {
    setIsDropdownOpen(true);
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Only close if focus is moving outside the entire component
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDropdownOpen(false);
    }
  };

  return (
    <SeerContainer onBlur={handleBlur}>
      <SearchForm onSubmit={handleSubmit}>
        <SearchInputContainer>
          <PositionedSearchIconContainer>
            <SearchIcon size="sm" />
          </PositionedSearchIconContainer>
          <SearchInput
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onFocus={handleFocus}
            placeholder={t('Ask Seer with Natural Language')}
            autoFocus
            isDropdownOpen={isDropdownOpen}
          />
          <PositionedCloseButtonContainer>
            <Button
              size="xs"
              icon={<IconClose />}
              onClick={() => setSeerMode(false)}
              aria-label={t('Close Seer search')}
              borderless
            />
          </PositionedCloseButtonContainer>
        </SearchInputContainer>
      </SearchForm>

      {isDropdownOpen && (
        <DropdownContent>
          <SeerContent>
            <List>
              {SUGGESTED_SEARCHES.map((suggestion, index) => (
                <ListItem key={index} onClick={() => setSearchQuery(suggestion)}>
                  {suggestion}
                </ListItem>
              ))}
            </List>
          </SeerContent>

          <SeerFooter>
            {openForm && (
              <Button
                size="xs"
                icon={<IconMegaphone />}
                onClick={() =>
                  openForm({
                    messagePlaceholder: t('How can we make Seer search better for you?'),
                    tags: {
                      ['feedback.source']: 'seer_search',
                      ['feedback.owner']: 'issues',
                    },
                  })
                }
              >
                {t('Give Feedback')}
              </Button>
            )}
          </SeerFooter>
        </DropdownContent>
      )}
    </SeerContainer>
  );
}

const SeerContainer = styled('div')`
  position: relative;
  width: 100%;
`;

const SearchForm = styled('form')`
  width: 100%;
`;

const SearchInputContainer = styled('div')`
  position: relative;
  width: 100%;
`;

const SearchInput = styled(Input)<{isDropdownOpen: boolean}>`
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1.5)} ${space(2)};
  padding-left: ${space(4)};
  border-bottom-left-radius: ${p => (p.isDropdownOpen ? '0' : p.theme.borderRadius)};
  border-bottom-right-radius: ${p => (p.isDropdownOpen ? '0' : p.theme.borderRadius)};

  &::placeholder {
    color: ${p => p.theme.subText};
  }
`;

const DropdownContent = styled('div')`
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: ${p => p.theme.zIndex.dropdown};
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-top: none;
  border-radius: ${p => p.theme.borderRadius};
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  box-shadow: ${p => p.theme.dropShadowHeavy};
  display: flex;
  flex-direction: column;
  min-height: 300px;
`;

const SeerContent = styled('div')`
  flex: 1;
  padding: ${space(3)};
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
`;

const SeerFooter = styled('div')`
  display: flex;
  justify-content: flex-end;
  padding: ${space(1.5)};
  border-top: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.backgroundSecondary};
`;

const SearchIcon = styled(IconSearch)`
  color: ${p => p.theme.subText};
  height: 22px;
`;

const PositionedSearchIconContainer = styled('div')`
  position: absolute;
  left: ${space(1.5)};
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  pointer-events: none;
  display: flex;
  align-items: center;
  height: 100%;
`;

const PositionedCloseButtonContainer = styled('div')`
  position: absolute;
  right: ${space(1)};
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
`;
