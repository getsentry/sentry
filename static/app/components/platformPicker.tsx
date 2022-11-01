import {useEffect, useMemo, useCallback, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import {PlatformIcon} from 'platformicons';

import Button from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import SearchBar from 'sentry/components/searchBar';
import {Item, TabList, TabPanels, Tabs} from 'sentry/components/tabs';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import categoryList, {filterAliases, PlatformKey} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {IconClose, IconProject} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, PlatformIntegration} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

const PLATFORM_CATEGORIES = [...categoryList, {id: 'all', name: t('All')}] as const;

type Category = typeof PLATFORM_CATEGORIES[number]['id'];

interface PlatformPickerProps {
  setPlatform: (key: PlatformKey | null) => void;
  defaultCategory?: Category;
  listClassName?: string;
  listProps?: React.HTMLAttributes<HTMLDivElement>;
  noAutoFilter?: boolean;
  organization?: Organization;
  platform?: string | null;
  showOther?: boolean;
  source?: string;
}

function PlatformPicker({
  platform,
  setPlatform,
  listProps,
  listClassName,
  defaultCategory,
  noAutoFilter,
  showOther = true,
  source,
  organization,
}: PlatformPickerProps) {
  const [category, setCategory] = useState<Category>(
    defaultCategory ?? PLATFORM_CATEGORIES[0].id
  );
  const [filter, setFilter] = useState(
    noAutoFilter ? '' : (platform ?? '').split('-')[0]
  );

  const getPlatformList = useCallback(
    (cat: Category) => {
      const currentCategory = categoryList.find(({id}) => id === cat);
      const lowercaseFilter = filter.toLowerCase();

      const subsetMatch = (p: PlatformIntegration) =>
        p.id.includes(lowercaseFilter) ||
        p.name.toLowerCase().includes(lowercaseFilter) ||
        filterAliases[p.id as PlatformKey]?.some(alias =>
          alias.includes(lowercaseFilter)
        );

      const categoryMatch = (p: PlatformIntegration) =>
        category === 'all' ||
        (currentCategory?.platforms as undefined | string[])?.includes(p.id);

      const filtered = platforms
        .filter(filter ? subsetMatch : categoryMatch)
        .sort((a, b) => a.id.localeCompare(b.id));

      return showOther ? filtered : filtered.filter(({id}) => id !== 'other');
    },
    [category, filter, showOther]
  );

  const logSearch = useMemo(
    () =>
      debounce((search: string, num_results: number) => {
        if (!search) {
          return;
        }

        trackAdvancedAnalyticsEvent('growth.platformpicker_search', {
          search,
          num_results,
          source,
          organization: organization ?? null,
        });
      }, DEFAULT_DEBOUNCE_DURATION),
    [organization, source]
  );

  useEffect(() => {
    logSearch(filter.toLowerCase(), getPlatformList(category).length);
  }, [filter, logSearch, category, getPlatformList]);

  return (
    <Tabs
      onChange={tab => {
        trackAdvancedAnalyticsEvent('growth.platformpicker_category', {
          category: tab,
          source,
          organization: organization ?? null,
        });
        setCategory(tab);
        setFilter('');
      }}
      value={filter ? 'all' : category}
    >
      <NavContainer>
        <TabList hideBorder>
          {PLATFORM_CATEGORIES.map(({id, name}) => (
            <Item key={id}>{name}</Item>
          ))}
        </TabList>
        <StyledSearchBar
          size="sm"
          query={filter}
          placeholder={t('Filter Platforms')}
          onChange={setFilter}
        />
      </NavContainer>
      <TabPanels>
        {PLATFORM_CATEGORIES.map(({id}) => {
          const platformList = getPlatformList(id);

          return (
            <Item key={id}>
              {platformList.length > 0 ? (
                <PlatformList className={listClassName} {...listProps}>
                  {platformList.map(platformItem => (
                    <PlatformCard
                      data-test-id={`platform-${platformItem.id}`}
                      key={platformItem.id}
                      platform={platformItem}
                      selected={platform === platformItem.id}
                      onClear={(e: React.MouseEvent) => {
                        setPlatform(null);
                        e.stopPropagation();
                      }}
                      onClick={() => {
                        trackAdvancedAnalyticsEvent('growth.select_platform', {
                          platform_id: platformItem.id,
                          source,
                          organization: organization ?? null,
                        });
                        setPlatform(platformItem.id as PlatformKey);
                      }}
                    />
                  ))}{' '}
                </PlatformList>
              ) : (
                <EmptyMessage
                  icon={<IconProject size="xl" />}
                  title={t("We don't have an SDK for that yet!")}
                >
                  {tct(
                    `Not finding your platform? You can still create your project,
                        but looks like we don't have an official SDK for your platform
                        yet. However, there's a rich ecosystem of community supported
                        SDKs (including Perl, CFML, Clojure, and ActionScript). Try
                        [search:searching for Sentry clients] or contacting support.`,
                    {
                      search: (
                        <ExternalLink href="https://github.com/search?q=-org%3Agetsentry+topic%3Asentry&type=Repositories" />
                      ),
                    }
                  )}
                </EmptyMessage>
              )}
            </Item>
          );
        })}
      </TabPanels>
    </Tabs>
  );
}

const NavContainer = styled('div')`
  margin-bottom: ${space(2)};
  display: grid;
  gap: ${space(2)};
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: start;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const StyledSearchBar = styled(SearchBar)`
  width: 12rem;
  margin-top: -${space(0.25)};

  @media only screen and (max-width: ${p => p.theme.breakpoints.small}) {
    width: 10em;
  }
`;

const PlatformList = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: repeat(auto-fill, 112px);
  margin-bottom: ${space(2)};
`;

const StyledPlatformIcon = styled(PlatformIcon)`
  margin: ${space(2)};
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
  background: ${p => p.theme.background};
  color: ${p => p.theme.textColor};
`;

ClearButton.defaultProps = {
  icon: <IconClose isCircled size="xs" />,
  borderless: true,
  size: 'xs',
};

const PlatformCard = styled(({platform, selected, onClear, ...props}) => (
  <div {...props}>
    <StyledPlatformIcon
      platform={platform.id}
      size={56}
      radius={5}
      withLanguageIcon
      format="lg"
    />

    <h3>{platform.name}</h3>
    {selected && <ClearButton onClick={onClear} aria-label={t('Clear')} />}
  </div>
))`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 0 14px;
  border-radius: 4px;
  cursor: pointer;
  background: ${p => p.selected && p.theme.alert.info.backgroundLight};

  &:hover {
    background: ${p => p.theme.alert.muted.backgroundLight};
  }

  h3 {
    flex-grow: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    color: ${p => (p.selected ? p.theme.textColor : p.theme.subText)};
    text-align: center;
    font-size: ${p => p.theme.fontSizeExtraSmall};
    text-transform: uppercase;
    margin: 0;
    padding: 0 ${space(0.5)};
    line-height: 1.2;
  }
`;

export default PlatformPicker;
