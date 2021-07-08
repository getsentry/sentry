import * as React from 'react';
import keydown from 'react-keydown';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import {PlatformIcon} from 'platformicons';

import Button from 'app/components/button';
import ExternalLink from 'app/components/links/externalLink';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import categoryList, {filterAliases, PlatformKey} from 'app/data/platformCategories';
import platforms from 'app/data/platforms';
import {IconClose, IconProject, IconSearch} from 'app/icons';
import {t, tct} from 'app/locale';
import {inputStyles} from 'app/styles/input';
import space from 'app/styles/space';
import {Organization, PlatformIntegration} from 'app/types';
import {trackAdvancedAnalyticsEvent} from 'app/utils/advancedAnalytics';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

const PLATFORM_CATEGORIES = [...categoryList, {id: 'all', name: t('All')}] as const;

const PlatformList = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
  grid-template-columns: repeat(auto-fill, 112px);
  margin-bottom: ${space(2)};
`;

type Category = typeof PLATFORM_CATEGORIES[number]['id'];

type Props = {
  setPlatform: (key: PlatformKey | null) => void;
  platform?: string | null;
  showOther?: boolean;
  listClassName?: string;
  listProps?: React.ComponentProps<typeof PlatformList>;
  noAutoFilter?: boolean;
  defaultCategory?: Category;
  organization?: Organization;
  source?: string;
};

type State = {
  category: Category;
  filter: string;
};

class PlatformPicker extends React.Component<Props, State> {
  static defaultProps = {
    showOther: true,
  };

  state: State = {
    category: this.props.defaultCategory ?? PLATFORM_CATEGORIES[0].id,
    filter: this.props.noAutoFilter ? '' : (this.props.platform || '').split('-')[0],
  };

  get platformList() {
    const {category} = this.state;
    const currentCategory = categoryList.find(({id}) => id === category);

    const filter = this.state.filter.toLowerCase();

    const subsetMatch = (platform: PlatformIntegration) =>
      platform.id.includes(filter) ||
      platform.name.toLowerCase().includes(filter) ||
      filterAliases[platform.id as PlatformKey]?.some(alias => alias.includes(filter));

    const categoryMatch = (platform: PlatformIntegration) =>
      category === 'all' ||
      (currentCategory?.platforms as undefined | string[])?.includes(platform.id);

    const filtered = platforms
      .filter(this.state.filter ? subsetMatch : categoryMatch)
      .sort((a, b) => a.id.localeCompare(b.id));

    return this.props.showOther ? filtered : filtered.filter(({id}) => id !== 'other');
  }

  logSearch = debounce(() => {
    if (this.state.filter) {
      trackAdvancedAnalyticsEvent(
        'growth.platformpicker_search',
        {
          search: this.state.filter.toLowerCase(),
          num_results: this.platformList.length,
          source: this.props.source,
        },
        this.props.organization ?? null
      );
    }
  }, 300);

  @keydown('/')
  focusSearch(e: KeyboardEvent) {
    if (e.target !== this.searchInput.current) {
      this.searchInput?.current?.focus();
      e.preventDefault();
    }
  }

  searchInput = React.createRef<HTMLInputElement>();

  render() {
    const platformList = this.platformList;
    const {setPlatform, listProps, listClassName} = this.props;
    const {filter, category} = this.state;

    return (
      <React.Fragment>
        <NavContainer>
          <CategoryNav>
            {PLATFORM_CATEGORIES.map(({id, name}) => (
              <ListLink
                key={id}
                onClick={(e: React.MouseEvent) => {
                  trackAdvancedAnalyticsEvent(
                    'growth.platformpicker_category',
                    {category: id, source: this.props.source},
                    this.props.organization ?? null
                  );
                  this.setState({category: id, filter: ''});
                  e.preventDefault();
                }}
                to=""
                isActive={() => id === (filter ? 'all' : category)}
              >
                {name}
              </ListLink>
            ))}
          </CategoryNav>
          <SearchBar>
            <IconSearch size="xs" />
            <input
              type="text"
              ref={this.searchInput}
              value={filter}
              placeholder={t('Filter Platforms')}
              onChange={e => this.setState({filter: e.target.value}, this.logSearch)}
            />
          </SearchBar>
        </NavContainer>
        <PlatformList className={listClassName} {...listProps}>
          {platformList.map(platform => (
            <PlatformCard
              data-test-id={`platform-${platform.id}`}
              key={platform.id}
              platform={platform}
              selected={this.props.platform === platform.id}
              onClear={(e: React.MouseEvent) => {
                setPlatform(null);
                e.stopPropagation();
              }}
              onClick={() => {
                trackAdvancedAnalyticsEvent(
                  'growth.select_platform',
                  {
                    platform_id: platform.id,
                    source: this.props.source,
                  },
                  this.props.organization ?? null
                );
                setPlatform(platform.id as PlatformKey);
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
      </React.Fragment>
    );
  }
}

const NavContainer = styled('div')`
  margin-bottom: ${space(2)};
  display: grid;
  grid-gap: ${space(2)};
  grid-template-columns: 1fr minmax(0, 300px);
  align-items: start;
  border-bottom: 1px solid ${p => p.theme.border};
`;

const SearchBar = styled('div')`
  ${p => inputStyles(p)};
  padding: 0 8px;
  color: ${p => p.theme.subText};
  display: flex;
  align-items: center;
  font-size: 15px;
  margin-top: -${space(0.75)};

  input {
    border: none;
    background: none;
    padding: 2px 4px;
    width: 100%;
    /* Ensure a consistent line height to keep the input the desired height */
    line-height: 24px;

    &:focus {
      outline: none;
    }
  }
`;

const CategoryNav = styled(NavTabs)`
  margin: 0;
  margin-top: 4px;
  white-space: nowrap;

  > li {
    float: none;
    display: inline-block;
  }
`;

const StyledPlatformIcon = styled(PlatformIcon)`
  margin: ${space(2)};
`;

const ClearButton = styled(Button)`
  position: absolute;
  top: -6px;
  right: -6px;
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
  size: 'xsmall',
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
    {selected && <ClearButton onClick={onClear} />}
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
