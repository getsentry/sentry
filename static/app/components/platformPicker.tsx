import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import {PlatformIcon} from 'platformicons';

import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import ExternalLink from 'sentry/components/links/externalLink';
import ListLink from 'sentry/components/links/listLink';
import NavTabs from 'sentry/components/navTabs';
import SearchBar from 'sentry/components/searchBar';
import {Tooltip} from 'sentry/components/tooltip';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import categoryList, {filterAliases, PlatformKey} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {IconClose, IconProject} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, PlatformIntegration} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';

const PLATFORM_CATEGORIES = [...categoryList, {id: 'all', name: t('All')}] as const;

const PlatformList = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: repeat(auto-fill, 112px);
  margin-bottom: ${space(2)};
`;

type Category = (typeof PLATFORM_CATEGORIES)[number]['id'];

interface PlatformPickerProps {
  setPlatform: (key: PlatformKey | null) => void;
  defaultCategory?: Category;
  disabledPlatforms?: {[key in PlatformKey]?: string};
  listClassName?: string;
  listProps?: React.HTMLAttributes<HTMLDivElement>;
  noAutoFilter?: boolean;
  organization?: Organization;
  platform?: string | null;
  showOther?: boolean;
  source?: string;
}

type State = {
  category: Category;
  filter: string;
};

class PlatformPicker extends Component<PlatformPickerProps, State> {
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

    const categoryMatch = (platform: PlatformIntegration) => {
      if (category === 'all') {
        return true;
      }

      // Symfony was no appering under the server category
      // because the php-symfony entry in src/sentry/integration-docs/_platforms.json
      // does not contain the suffix 2.
      // This is a temporary fix until we can update that file or completly remove the php-symfony2 occurrences
      if (
        (platform.id as any) === 'php-symfony' &&
        (currentCategory?.platforms as undefined | string[])?.includes('php-symfony2')
      ) {
        return true;
      }
      return (currentCategory?.platforms as undefined | string[])?.includes(platform.id);
    };

    const filtered = platforms
      .filter(this.state.filter ? subsetMatch : categoryMatch)
      .sort((a, b) => a.id.localeCompare(b.id));

    return this.props.showOther ? filtered : filtered.filter(({id}) => id !== 'other');
  }

  logSearch = debounce(() => {
    if (this.state.filter) {
      trackAdvancedAnalyticsEvent('growth.platformpicker_search', {
        search: this.state.filter.toLowerCase(),
        num_results: this.platformList.length,
        source: this.props.source,
        organization: this.props.organization ?? null,
      });
    }
  }, DEFAULT_DEBOUNCE_DURATION);

  render() {
    const platformList = this.platformList;
    const {setPlatform, listProps, listClassName, disabledPlatforms} = this.props;
    const {filter, category} = this.state;

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
                    source: this.props.source,
                    organization: this.props.organization ?? null,
                  });
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
          <StyledSearchBar
            size="sm"
            query={filter}
            placeholder={t('Filter Platforms')}
            onChange={val => this.setState({filter: val}, this.logSearch)}
          />
        </NavContainer>
        <PlatformList className={listClassName} {...listProps}>
          {platformList.map(platform => {
            const disabled = !!disabledPlatforms?.[platform.id as PlatformKey];
            const content = (
              <PlatformCard
                data-test-id={`platform-${platform.id}`}
                key={platform.id}
                platform={platform}
                disabled={disabled}
                selected={this.props.platform === platform.id}
                onClear={(e: React.MouseEvent) => {
                  setPlatform(null);
                  e.stopPropagation();
                }}
                onClick={() => {
                  if (disabled) {
                    return;
                  }

                  trackAdvancedAnalyticsEvent('growth.select_platform', {
                    platform_id: platform.id,
                    source: this.props.source,
                    organization: this.props.organization ?? null,
                  });
                  setPlatform(platform.id as PlatformKey);
                }}
              />
            );

            if (disabled) {
              return (
                <Tooltip
                  title={disabledPlatforms?.[platform.id as PlatformKey]}
                  key={platform.id}
                >
                  {content}
                </Tooltip>
              );
            }

            return content;
          })}
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
  }
}

const NavContainer = styled('div')`
  margin-bottom: ${space(2)};
  display: grid;
  gap: ${space(2)};
  grid-template-columns: 1fr minmax(0, 300px);
  align-items: start;
  border-bottom: 1px solid ${p => p.theme.border};
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
  background: ${p => p.selected && p.theme.alert.info.backgroundLight};

  &:hover {
    background: ${p => p.theme.alert.muted.backgroundLight};
  }

  opacity: ${p => (p.disabled ? 0.2 : null)};
  cursor: ${p => (p.disabled ? 'not-allowed' : 'pointer')};

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
