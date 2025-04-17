import styled from '@emotion/styled';

import {t, tct} from 'sentry/locale';
import {DrawerTab} from 'sentry/views/issueDetails/groupDistributions/types';

export default function HeaderTitle({
  includeFeatureFlagsTab,
  tab,
  tagKey,
}: {
  includeFeatureFlagsTab: boolean;
  tab: DrawerTab;
  tagKey: string | undefined;
}) {
  if (tagKey) {
    return (
      <Header>
        {tab === DrawerTab.TAGS
          ? tct('Tag Details - [tagKey]', {tagKey})
          : tct('Feature Flag Details - [tagKey]', {tagKey})}
      </Header>
    );
  }

  return (
    <Header>{includeFeatureFlagsTab ? t('Tags & Feature Flags') : t('All Tags')}</Header>
  );
}

const Header = styled('h3')`
  ${p => p.theme.overflowEllipsis};
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  margin: 0;
`;
