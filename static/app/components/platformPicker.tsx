import {Fragment, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import {PlatformIcon} from 'platformicons';

import {Button} from 'sentry/components/core/button';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingMask from 'sentry/components/loadingMask';
import SearchBar from 'sentry/components/searchBar';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import {consoles, gaming} from 'sentry/data/platformCategories';
import {
  categoryList,
  createablePlatforms,
  filterAliases,
} from 'sentry/data/platformPickerCategories';
import platforms, {otherPlatform} from 'sentry/data/platforms';
import {IconClose, IconProject} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {PlatformIntegration} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';

const PlatformList = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: repeat(auto-fill, 112px);
  margin-bottom: ${space(2)};

  &.centered {
    justify-content: center;
  }
`;

const selectablePlatforms = platforms.filter(platform =>
  createablePlatforms.has(platform.id)
);

function startsWithPunctuation(name: string) {
  return /^[\p{P}]/u.test(name);
}

export type Category = (typeof categoryList)[number]['id'];

export type Platform = PlatformIntegration & {
  category: Category;
};

interface PlatformPickerProps {
  setPlatform: (props: Platform | null) => void;
  defaultCategory?: Category;
  listClassName?: string;
  listProps?: React.HTMLAttributes<HTMLDivElement>;
  loading?: boolean;
  modal?: boolean;
  navClassName?: string;
  noAutoFilter?: boolean;
  organization?: Organization;
  platform?: string | null;
  showFilterBar?: boolean;
  showOther?: boolean;
  source?: string;
  /**
   * When `false`, hides the close button and does not display a custom background color.
   */
  visibleSelection?: boolean;
}

function PlatformPicker({
  defaultCategory,
  noAutoFilter,
  platform,
  setPlatform,
  listProps,
  listClassName,
  navClassName,
  organization,
  source,
  visibleSelection = true,
  loading = false,
  showFilterBar = true,
  showOther = true,
}: PlatformPickerProps) {
  const {isSelfHosted} = useLegacyStore(ConfigStore);

  const [category, setCategory] = useState(defaultCategory ?? categoryList[0]!.id);
  const [filter, setFilter] = useState(
    noAutoFilter ? '' : (platform || '').split('-')[0]!
  );

  const availablePlatforms = useMemo(() => {
    const gamingPlatforms = platforms.filter(p => {
      if (!gaming.includes(p.id) || createablePlatforms.has(p.id)) {
        return false;
      }
      if (isSelfHosted) {
        return !consoles.includes(p.id);
      }

      return true;
    });

    return [...selectablePlatforms, ...gamingPlatforms];
  }, [isSelfHosted]);

  const platformList = useMemo(() => {
    const currentCategory = categoryList.find(({id}) => id === category);

    const subsetMatch = (platformIntegration: PlatformIntegration) =>
      platformIntegration.id.includes(filter.toLowerCase()) ||
      platformIntegration.name.toLowerCase().includes(filter.toLowerCase()) ||
      filterAliases[platformIntegration.id]?.some(alias =>
        alias.includes(filter.toLowerCase())
      );

    const categoryMatch = (platformIntegration: PlatformIntegration) => {
      return currentCategory?.platforms?.has(platformIntegration.id);
    };

    // 'other' is not part of the createablePlatforms list, therefore it won't be included in the filtered list
    const filtered = availablePlatforms.filter(filter ? subsetMatch : categoryMatch);

    if (showOther && filter.toLowerCase() === 'other') {
      // We only show 'Other' if users click on the 'Other' suggestion rendered in the not found state or type this word in the search bar
      return [otherPlatform];
    }

    if (category === 'popular') {
      const popularPlatformList = Array.from(currentCategory?.platforms ?? []);
      // We keep the order of the platforms defined in the set
      return filtered.sort(
        (a, b) => popularPlatformList.indexOf(a.id) - popularPlatformList.indexOf(b.id)
      );
    }

    // We only want to sort the platforms alphabetically if users are not viewing the 'popular' tab category
    return filtered.sort((a, b) => {
      if (startsWithPunctuation(a.name) && !startsWithPunctuation(b.name)) {
        return 1;
      }
      if (!startsWithPunctuation(a.name) && startsWithPunctuation(b.name)) {
        return -1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [filter, category, availablePlatforms, showOther]);

  const latestValuesRef = useRef({
    filter,
    platformList,
    source,
    organization,
    category,
  });

  useEffect(() => {
    latestValuesRef.current = {filter, platformList, source, organization, category};
  });

  const debounceSearch = useRef(
    debounce(() => {
      const {
        filter: currentFilter,
        platformList: currentPlatformList,
        source: currentSource,
        organization: currentOrganization,
        category: currentCategory,
      } = latestValuesRef.current;

      if (!currentFilter) {
        return;
      }
      trackAnalytics('growth.platformpicker_search', {
        search: currentFilter.toLowerCase(),
        num_results: currentPlatformList.length,
        source: currentSource,
        organization: currentOrganization ?? null,
      });

      if (!visibleSelection) {
        return;
      }

      const fullPlatformMatch = currentPlatformList.find(
        platformItem => platformItem.name.toLowerCase() === currentFilter.toLowerCase()
      );

      if (!fullPlatformMatch) {
        return;
      }

      setPlatform({...fullPlatformMatch, category: currentCategory});
    }, DEFAULT_DEBOUNCE_DURATION)
  ).current;

  return (
    <Fragment>
      <NavContainer className={navClassName}>
        <TabsContainer>
          <Tabs
            value={category}
            onChange={val => {
              trackAnalytics('growth.platformpicker_category', {
                category: val,
                source,
                organization: organization ?? null,
              });
              setCategory(val);
              setFilter('');
            }}
          >
            <TabList>
              {categoryList.map(({id, name}) => (
                <TabList.Item key={id}>{name}</TabList.Item>
              ))}
            </TabList>
          </Tabs>
        </TabsContainer>
        {showFilterBar && (
          <StyledSearchBar
            size="sm"
            query={filter}
            placeholder={t('Filter Platforms')}
            onChange={val => {
              setFilter(val);
              debounceSearch();
            }}
          />
        )}
      </NavContainer>
      <PlatformList className={listClassName} {...listProps}>
        {platformList.map(item => {
          return (
            <div key={item.id} style={{position: 'relative'}}>
              <TransparentLoadingMask visible={loading} />
              <PlatformCard
                visibleSelection={visibleSelection}
                data-test-id={`platform-${item.id}`}
                platform={item}
                selected={platform === item.id}
                onClear={(e: React.MouseEvent) => {
                  setPlatform(null);
                  e.stopPropagation();
                }}
                onClick={() => {
                  trackAnalytics('growth.select_platform', {
                    platform_id: item.id,
                    source,
                    organization: organization ?? null,
                  });

                  setPlatform({...item, category});
                }}
              />
            </div>
          );
        })}
      </PlatformList>
      {platformList.length === 0 && (
        <EmptyMessage
          icon={<IconProject />}
          title={t("We don't have an SDK for that yet!")}
        >
          {tct(
            `Sure you haven't misspelled? If you're using a lesser-known platform, consider choosing a more generic SDK like Browser JavaScript, Python, Node, .NET & Java or create a generic project, by selecting [linkOther:“Other”].`,
            {
              linkOther: (
                <Button
                  aria-label={t("Select 'Other'")}
                  priority="link"
                  onClick={() => {
                    setFilter(otherPlatform.name);
                    setPlatform({...otherPlatform, category});
                  }}
                />
              ),
            }
          )}
        </EmptyMessage>
      )}
    </Fragment>
  );
}

const TabsContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

const NavContainer = styled('div')`
  margin-bottom: ${space(2)};
  display: grid;
  gap: ${space(2)};
  grid-template-columns: 1fr minmax(0, 200px);
  align-items: start;

  &.centered {
    grid-template-columns: none;
    justify-content: center;
  }
`;

const StyledSearchBar = styled(SearchBar)`
  min-width: 6rem;
  max-width: 12rem;
  margin-top: -${space(0.25)};
  margin-left: auto;
  flex-shrink: 0;
  flex-basis: 0;
  flex-grow: 1;
`;

const StyledPlatformIcon = styled(PlatformIcon)`
  margin: ${space(2)};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
`;

const ClearButton = styled(Button)`
  position: absolute;
  top: -6px;
  right: -6px;
  min-height: 0;
  height: 22px;
  width: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: ${p => p.theme.tokens.background.primary};
  color: ${p => p.theme.tokens.content.primary};
`;

const TransparentLoadingMask = styled(LoadingMask)<{visible: boolean}>`
  ${p => !p.visible && 'display: none;'};
  opacity: 0.4;
  z-index: 1;
`;

const PlatformCard = styled(
  ({platform, selected, visibleSelection, onClear, ...props}: any) => (
    <div {...props}>
      <StyledPlatformIcon
        platform={platform.id}
        size={56}
        radius={5}
        withLanguageIcon={platform.iconConfig?.withLanguageIcon ?? true}
        format="lg"
      />
      <h3>{platform.name}</h3>
      {selected && visibleSelection && (
        <ClearButton
          icon={<IconClose />}
          borderless
          size="xs"
          onClick={onClear}
          aria-label={t('Clear')}
        />
      )}
    </div>
  )
)`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 0 14px;
  border-radius: 4px;
  cursor: ${p => (p.loading ? 'default' : 'pointer')};

  ${p =>
    p.selected &&
    p.visibleSelection &&
    `background: ${p.theme.alert.info.backgroundLight};`}

  &:hover {
    background: ${p => p.theme.alert.muted.backgroundLight};
  }

  h3 {
    flex-grow: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    color: ${p =>
      p.selected ? p.theme.tokens.content.primary : p.theme.tokens.content.secondary};
    text-align: center;
    font-size: ${p => p.theme.fontSize.xs};
    text-transform: uppercase;
    margin: 0;
    padding: 0 ${space(0.5)};
    line-height: 1.2;
  }
`;

export default PlatformPicker;
