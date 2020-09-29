import React from 'react';
import styled from '@emotion/styled';

import {t, tn} from 'app/locale';
import Search from 'app/components/search';
import HelpSource from 'app/components/search/sources/helpSource';
import SearchResult from 'app/components/search/searchResult';
import SearchResultWrapper from 'app/components/search/searchResultWrapper';
import space from 'app/styles/space';
import {IconWindow} from 'app/icons';

type HelpResult = Parameters<
  React.ComponentProps<typeof HelpSource>['children']
>[0]['results'][0];

type ResultItemProps = HelpResult & {
  highlighted: boolean;
  // TODO(ts): Improve types when we've typed more of the search components
  itemProps: any;
};

const renderResult = ({item, matches, itemProps, highlighted}: ResultItemProps) => {
  const sectionHeading =
    item.sectionHeading !== undefined ? (
      <SectionHeading>
        <IconWindow />
        {t('From %s', item.sectionHeading)}
        <Count>{tn('%s result', '%s results', item.sectionCount ?? 0)}</Count>
      </SectionHeading>
    ) : null;

  if (item.empty) {
    return (
      <React.Fragment>
        {sectionHeading}
        <Empty>{t('No results from %s', item.sectionHeading)}</Empty>
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      {sectionHeading}
      <SearchResultWrapper {...itemProps} highlighted={highlighted}>
        <SearchResult highlighted={highlighted} item={item} matches={matches} />
      </SearchResultWrapper>
    </React.Fragment>
  );
};

// TODO(ts): Type based on Search props once that has types
const HelpSearch = props => (
  <Search
    {...props}
    sources={[HelpSource]}
    minSearch={3}
    closeOnSelect={false}
    renderItem={renderResult}
  />
);

const SectionHeading = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  grid-gap: ${space(1)};
  align-items: center;
  background: ${p => p.theme.gray200};
  padding: ${space(1)} ${space(2)};

  &:not(:first-of-type) {
    border-top: 1px solid ${p => p.theme.borderLight};
  }
`;

const Count = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray500};
`;

const Empty = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(2)};
  color: ${p => p.theme.gray600};
  font-size: ${p => p.theme.fontSizeMedium};
  border-top: 1px solid ${p => p.theme.borderLight};
`;

export default HelpSearch;
