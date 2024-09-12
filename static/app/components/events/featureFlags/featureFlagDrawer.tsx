import {useState} from 'react';
import styled from '@emotion/styled';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Breadcrumbs as NavigationBreadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import {CompactSelect} from 'sentry/components/compactSelect';
import DropdownButton from 'sentry/components/dropdownButton';
import {
  CardContainer,
  FLAG_SORT_OPTIONS,
  FlagSort,
  getLabel,
} from 'sentry/components/events/featureFlags/eventFeatureFlagList';
import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {InputGroup} from 'sentry/components/inputGroup';
import KeyValueData, {
  type KeyValueDataContentProps,
} from 'sentry/components/keyValueData';
import {IconSearch, IconSort} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getShortEventId} from 'sentry/utils/events';
import {MIN_NAV_HEIGHT} from 'sentry/views/issueDetails/streamline/eventNavigation';

export const enum FlagControlOptions {
  SEARCH = 'search',
  SORT = 'sort',
}

interface FlagDrawerProps {
  event: Event;
  featureFlags: KeyValueDataContentProps[];
  group: Group;
  project: Project;
}

export function FeatureFlagDrawer({
  featureFlags,
  group,
  event,
  project,
}: FlagDrawerProps) {
  const [sortMethod, setSortMethod] = useState<FlagSort>(FlagSort.RECENT);
  const [flags, setFlags] = useState<KeyValueDataContentProps[]>(featureFlags);
  const [search, setSearch] = useState('');

  const handleSortRecent = () => {
    setFlags(featureFlags);
  };

  const handleSortAlphabetical = () => {
    setFlags(
      flags.sort((a, b) => {
        return a.item.key.localeCompare(b.item.key);
      })
    );
  };

  const actions = (
    <ButtonBar gap={1}>
      <InputGroup>
        <SearchInput
          size="xs"
          value={search}
          onChange={e => {
            // good spot to track analytics
            setSearch(e.target.value.toLowerCase());
            setFlags(featureFlags.filter(f => f.item.key.includes(search)));
          }}
          aria-label={t('Search All Flags')}
        />
        <InputGroup.TrailingItems disablePointerEvents>
          <IconSearch size="xs" />
        </InputGroup.TrailingItems>
      </InputGroup>
      <CompactSelect
        triggerProps={{
          'aria-label': t('Sort Flags'),
          showChevron: false,
        }}
        onChange={selection => {
          // good spot to track analytics
          setSortMethod(selection.value);
          selection.value === FlagSort.RECENT
            ? handleSortRecent()
            : handleSortAlphabetical();
        }}
        trigger={triggerProps => (
          <DropdownButton {...triggerProps} size="xs" icon={<IconSort />}>
            {getLabel(sortMethod)}
          </DropdownButton>
        )}
        value={sortMethod}
        options={FLAG_SORT_OPTIONS}
      />
    </ButtonBar>
  );

  return (
    <FlagDrawerContainer>
      <FlagDrawerHeader>
        <NavigationCrumbs
          crumbs={[
            {
              label: (
                <CrumbContainer>
                  <ProjectAvatar project={project} />
                  <ShortId>{group.shortId}</ShortId>
                </CrumbContainer>
              ),
            },
            {label: getShortEventId(event.id)},
            {label: t('Feature Flags')},
          ]}
        />
      </FlagDrawerHeader>
      <FlagNavigator>
        <Header>{t('Feature Flags')}</Header>
        {actions}
      </FlagNavigator>
      <FlagDrawerBody>
        <CardContainer>
          <KeyValueData.Card contentItems={flags} />
        </CardContainer>
      </FlagDrawerBody>
    </FlagDrawerContainer>
  );
}

const FlagDrawerContainer = styled('div')`
  height: 100%;
  display: grid;
  grid-template-rows: auto auto 1fr;
`;

const FlagDrawerHeader = styled(DrawerHeader)`
  position: unset;
  max-height: ${MIN_NAV_HEIGHT}px;
  box-shadow: none;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const FlagNavigator = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  column-gap: ${space(1)};
  padding: ${space(0.75)} 24px;
  background: ${p => p.theme.background};
  z-index: 1;
  min-height: ${MIN_NAV_HEIGHT}px;
  box-shadow: ${p => p.theme.translucentBorder} 0 1px;
`;

const FlagDrawerBody = styled(DrawerBody)`
  overflow: auto;
  overscroll-behavior: contain;
  /* Move the scrollbar to the left edge */
  scroll-margin: 0 ${space(2)};
  direction: rtl;
  * {
    direction: ltr;
  }
`;

const Header = styled('h3')`
  display: block;
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: ${p => p.theme.fontWeightBold};
  margin: 0;
`;

const SearchInput = styled(InputGroup.Input)`
  border: 0;
  box-shadow: unset;
  color: inherit;
`;

const NavigationCrumbs = styled(NavigationBreadcrumbs)`
  margin: 0;
  padding: 0;
`;

const CrumbContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const ShortId = styled('div')`
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 1;
`;
