import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Search} from 'sentry/components/search';
import SearchResult from 'sentry/components/search/searchResult';
import SearchResultWrapper from 'sentry/components/search/searchResultWrapper';
import HelpSource from 'sentry/components/search/sources/helpSource';
import {IconWindow} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type ItemRenderer = React.ComponentProps<typeof Search>['renderItem'];

const renderResult: ItemRenderer = ({item, matches, itemProps, highlighted}) => {
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
      <Fragment>
        {sectionHeading}
        <Empty>{t('No results from %s', item.sectionHeading)}</Empty>
      </Fragment>
    );
  }

  return (
    <Fragment>
      {sectionHeading}
      <SearchResultWrapper {...itemProps} highlighted={highlighted}>
        <SearchResult highlighted={highlighted} item={item} matches={matches} />
      </SearchResultWrapper>
    </Fragment>
  );
};

type Props = Omit<
  React.ComponentProps<typeof Search>,
  'sources' | 'minSearch' | 'closeOnSelect' | 'renderItem'
>;

// TODO(ts): Type based on Search props once that has types
function HelpSearch(props: Props) {
  return (
    <Search
      {...props}
      sources={[HelpSource]}
      minSearch={3}
      closeOnSelect={false}
      renderItem={renderResult}
    />
  );
}

const SectionHeading = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr max-content;
  gap: ${space(1)};
  align-items: center;
  background: ${p => p.theme.backgroundSecondary};
  padding: ${space(1)} ${space(2)};

  &:not(:first-of-type) {
    border-top: 1px solid ${p => p.theme.innerBorder};
  }
`;

const Count = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
`;

const Empty = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(2)};
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  border-top: 1px solid ${p => p.theme.innerBorder};
`;

export default HelpSearch;
