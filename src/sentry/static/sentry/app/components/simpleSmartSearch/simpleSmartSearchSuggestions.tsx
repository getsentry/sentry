import React from 'react';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import {IconClock} from 'app/icons/iconClock';
import {IconTelescope} from 'app/icons/iconTelescope';
import {t} from 'app/locale';
import space from 'app/styles/space';

type Result = {
  id: number;
  description: string;
};

type Props = {
  resultsTitle?: string;
  results: Array<Result>;
};

const SimpleSmartSearchSuggestions = ({resultsTitle, results}: Props) => {
  console.log('results', results);
  return (
    <SuggestionsWrapper>
      <div>
        <SuggestionGroupHeader>
          <IconTelescope />
          {resultsTitle || t('Results')}
        </SuggestionGroupHeader>
        <SuggestionGroupList>
          {results.length === 0 ? (
            <SuggestionGroupListItem>{t('No Results found')}</SuggestionGroupListItem>
          ) : (
            results.map(result => (
              <SuggestionGroupListItem key={result.id} cursorPointer>
                {result.description}
              </SuggestionGroupListItem>
            ))
          )}
        </SuggestionGroupList>
      </div>
      <div>
        <SuggestionGroupHeader>
          <IconClock />
          {t('Recent Searches')}
        </SuggestionGroupHeader>
        <SuggestionGroupList>
          <SuggestionGroupListItem>Suggestion 1</SuggestionGroupListItem>
          <SuggestionGroupListItem>Suggestion 2</SuggestionGroupListItem>
        </SuggestionGroupList>
      </div>
    </SuggestionsWrapper>
  );
};

export default SimpleSmartSearchSuggestions;

const SuggestionsWrapper = styled('div')`
  position: absolute;
  width: 100%;
  background: ${p => p.theme.white};
  box-shadow: 0 2px 0 rgba(37,11,54,0.04);
  border: 1px solid ${p => p.theme.borderDark};
  border-top: 0;
  border-bottom: 0;
  border-radius: 0 0 4px 4px;
  z-index: ${p => p.theme.zIndex.dropdown};
  overflow: hidden;
}
`;

const SuggestionGroupHeader = styled('div')`
  display: grid;
  grid-template-columns: 16px 1fr;
  grid-gap: ${space(1)};
  align-items: center;
  background-color: ${p => p.theme.offWhite};
  color: ${p => p.theme.gray2};
  font-size: ${p => p.theme.fontSizeMedium};
  padding: ${space(1)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.borderLight};
`;

const SuggestionGroupList = styled('ul')`
  padding-left: 0;
  list-style: none;
  margin-bottom: 0;
`;

const SuggestionGroupListItem = styled('li')<{cursorPointer?: boolean}>`
  border-bottom: 1px solid ${p => p.theme.borderLight};
  padding: ${space(1)} ${space(2)};
  font-size: ${p => p.theme.fontSizeSmall};
  font-family: ${p => p.theme.text.familyMono};
  ${p =>
    p.cursorPointer &&
    css`
      cursor: pointer;
    `}
`;
