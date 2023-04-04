import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import {PlatformIcon} from 'platformicons';

import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import ListLink from 'sentry/components/links/listLink';
import NavTabs from 'sentry/components/navTabs';
import SearchBar from 'sentry/components/searchBar';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import categoryList, {
  filterAliases,
  PlatformKey,
  popularPlatformCategories,
} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {IconClose, IconProject} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, PlatformIntegration} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

const PLATFORM_CATEGORIES = [{id: 'all', name: t('All')}, ...categoryList] as const;

// Category needs the all option while CategoryObj does not
type Category = (typeof PLATFORM_CATEGORIES)[number]['id'];
type CategoryObj = (typeof categoryList)[number];
type Platform = CategoryObj['platforms'][number];

// create a lookup table for each platform
const indexByPlatformByCategory = {} as Record<
  CategoryObj['id'],
  Record<Platform, number>
>;
categoryList.forEach(category => {
  const indexByPlatform = {} as Record<Platform, number>;
  indexByPlatformByCategory[category.id] = indexByPlatform;
  category.platforms.forEach((platform: Platform, index: number) => {
    indexByPlatform[platform] = index;
  });
});

const getIndexOfPlatformInCategory = (
  category: CategoryObj['id'],
  platform: PlatformIntegration
) => {
  const indexByPlatform = indexByPlatformByCategory[category];
  return indexByPlatform[platform.id];
};

const isPopular = (platform: PlatformIntegration) =>
  popularPlatformCategories.includes(
    platform.id as (typeof popularPlatformCategories)[number]
  );

const popularIndex = (platform: PlatformIntegration) =>
  getIndexOfPlatformInCategory('popular', platform);

const PlatformList = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: repeat(auto-fill, 112px);
  justify-content: center;
  margin-bottom: ${space(2)};
`;

interface PlatformPickerProps {
  addPlatform: (key: PlatformKey) => void;
  organization: Organization;
  platforms: PlatformKey[];
  removePlatform: (key: PlatformKey) => void;
  source: string;
  defaultCategory?: Category;
  listClassName?: string;
  listProps?: React.HTMLAttributes<HTMLDivElement>;
  noAutoFilter?: boolean;
  showOther?: boolean;
}

const PlatformPicker = (props: PlatformPickerProps) => {
  const {organization, source} = props;
  const [category, setCategory] = useState<Category>(
    props.defaultCategory ?? PLATFORM_CATEGORIES[0].id
  );
  const [filter, setFilter] = useState<string>(
    props.noAutoFilter ? '' : (props.platforms[0] || '').split('-')[0]
  );

  function getPlatformList() {
    const currentCategory = categoryList.find(({id}) => id === category);

    const filterLowerCase = filter.toLowerCase();

    const subsetMatch = (platform: PlatformIntegration) =>
      platform.id.includes(filterLowerCase) ||
      platform.name.toLowerCase().includes(filterLowerCase) ||
      filterAliases[platform.id]?.some(alias => alias.includes(filterLowerCase));

    const categoryMatch = (platform: PlatformIntegration) =>
      category === 'all' ||
      (currentCategory?.platforms as undefined | string[])?.includes(platform.id);

    const customCompares = (a: PlatformIntegration, b: PlatformIntegration) => {
      // the all category and serverless category both require custom sorts
      if (category === 'all') {
        return popularTopOfAllCompare(a, b);
      }
      if (category === 'serverless') {
        return serverlessCompare(a, b);
      }
      // maintain ordering otherwise
      return (
        getIndexOfPlatformInCategory(category, a) -
        getIndexOfPlatformInCategory(category, b)
      );
    };

    const popularTopOfAllCompare = (a: PlatformIntegration, b: PlatformIntegration) => {
      // for the all category, put popular ones at the top in the order they appear in the popular list
      if (isPopular(a) && isPopular(b)) {
        // if both popular, maintain ordering from popular list
        return popularIndex(a) - popularIndex(b);
      }
      // if one popular, that one should be first
      if (isPopular(a) !== isPopular(b)) {
        return isPopular(a) ? -1 : 1;
      }
      // since the all list is coming from a different source (platforms.json)
      // we can't go off the index of the item in platformCategories.tsx since there is no all list
      return a.id.localeCompare(b.id);
    };

    const serverlessCompare = (a: PlatformIntegration, b: PlatformIntegration) => {
      // for the serverless category, sort by service, then language
      // the format of the ids is language-service
      const aProvider = a.id.split('-')[1];
      const bProvider = b.id.split('-')[1];
      // if either of the ids are not hyphenated, standard sort
      if (!aProvider || !bProvider) {
        return a.id.localeCompare(b.id);
      }
      // compare the portions after the hyphen
      const compareServices = aProvider.localeCompare(bProvider);
      // if they have the same service provider
      if (!compareServices) {
        return a.id.localeCompare(b.id);
      }
      return compareServices;
    };

    const filtered = platforms
      .filter(filterLowerCase ? subsetMatch : categoryMatch)
      .sort(customCompares);
    return props.showOther ? filtered : filtered.filter(({id}) => id !== 'other');
  }

  const platformList = getPlatformList();
  const {addPlatform, removePlatform, listProps, listClassName} = props;

  const logSearch = debounce(() => {
    if (filter) {
      trackAdvancedAnalyticsEvent('growth.platformpicker_search', {
        search: filter.toLowerCase(),
        num_results: platformList.length,
        source,
        organization,
      });
    }
  }, DEFAULT_DEBOUNCE_DURATION);

  useEffect(logSearch, [filter, logSearch]);

  return (
    <Fragment>
      <NavContainer>
        <CategoryNav>
          {PLATFORM_CATEGORIES.map(({id, name}) => (
            <ListLink
              key={id}
              onClick={(e: React.MouseEvent) => {
                trackAdvancedAnalyticsEvent('growth.platformpicker_category', {
                  category: id,
                  source,
                  organization,
                });
                setCategory(id);
                setFilter('');
                e.preventDefault();
              }}
              to=""
              isActive={() => id === (filter ? 'all' : category)}
            >
              {name}
            </ListLink>
          ))}
        </CategoryNav>
        <StyledSearchBar
          size="sm"
          query={filter}
          placeholder={t('Filter Platforms')}
          onChange={setFilter}
        />
      </NavContainer>
      <PlatformList className={listClassName} {...listProps}>
        {platformList.map(platform => (
          <PlatformCard
            data-test-id={`platform-${platform.id}`}
            key={platform.id}
            platform={platform}
            selected={props.platforms.includes(platform.id)}
            onClear={(e: React.MouseEvent) => {
              removePlatform(platform.id);
              e.stopPropagation();
            }}
            onClick={() => {
              // do nothing if already selected
              if (props.platforms.includes(platform.id)) {
                return;
              }
              trackAdvancedAnalyticsEvent('growth.select_platform', {
                platform_id: platform.id,
                source,
                organization,
              });
              addPlatform(platform.id);
            }}
          />
        ))}
      </PlatformList>
      {platformList.length === 0 && (
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
    </Fragment>
  );
};

const NavContainer = styled('div')`
  margin-bottom: ${space(2)};
  display: flex;
  flex-direction: row;
  align-items: start;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const StyledSearchBar = styled(SearchBar)`
  max-width: 300px;
  min-width: 150px;
  margin-top: -${space(0.25)};
  margin-left: auto;
  flex-shrink: 0;
  flex-basis: 0;
  flex-grow: 1;
`;

const CategoryNav = styled(NavTabs)`
  margin: 0;
  margin-top: 4px;
  white-space: nowrap;
  overflow-x: scroll;
  overflow-y: hidden;
  margin-right: ${space(1)};
  flex-shrink: 1;
  flex-grow: 0;

  > li {
    float: none;
    display: inline-block;
  }
  ::-webkit-scrollbar {
    display: none;
  }
  -ms-overflow-style: none;
  scrollbar-width: none;
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
