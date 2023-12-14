import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import {PlatformIcon} from 'platformicons';

import {Button} from 'sentry/components/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import ListLink from 'sentry/components/links/listLink';
import NavTabs from 'sentry/components/navTabs';
import SearchBar from 'sentry/components/searchBar';
import {DEFAULT_DEBOUNCE_DURATION} from 'sentry/constants';
import categoryList, {
  createablePlatforms,
  filterAliases,
} from 'sentry/data/platformPickerCategories';
import platforms, {otherPlatform} from 'sentry/data/platforms';
import {IconClose, IconProject} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, PlatformIntegration, PlatformKey} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';

const PlatformList = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: repeat(auto-fill, 112px);
  margin-bottom: ${space(2)};
`;

const selectablePlatforms = platforms.filter(platform =>
  createablePlatforms.has(platform.id)
);

export type Category = (typeof categoryList)[number]['id'];

export type Platform = PlatformIntegration & {
  category: Category;
};

interface PlatformPickerProps {
  setPlatform: (props: Platform | null) => void;
  defaultCategory?: Category;
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
    category: this.props.defaultCategory ?? categoryList[0].id,
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
      return currentCategory?.platforms?.has(platform.id);
    };

    const filtered = selectablePlatforms
      .filter(this.state.filter ? subsetMatch : categoryMatch)
      .sort((a, b) => a.id.localeCompare(b.id));

    return this.props.showOther ? filtered : filtered.filter(({id}) => id !== 'other');
  }

  logSearch = debounce(() => {
    if (this.state.filter) {
      trackAnalytics('growth.platformpicker_search', {
        search: this.state.filter.toLowerCase(),
        num_results: this.platformList.length,
        source: this.props.source,
        organization: this.props.organization ?? null,
      });
    }
  }, DEFAULT_DEBOUNCE_DURATION);

  render() {
    const platformList = this.platformList;
    const {setPlatform, listProps, listClassName} = this.props;
    const {filter, category} = this.state;

    return (
      <Fragment>
        <NavContainer>
          <CategoryNav>
            {categoryList.map(({id, name}) => (
              <ListLink
                key={id}
                onClick={(e: React.MouseEvent) => {
                  trackAnalytics('growth.platformpicker_category', {
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
            return (
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
                  trackAnalytics('growth.select_platform', {
                    platform_id: platform.id,
                    source: this.props.source,
                    organization: this.props.organization ?? null,
                  });
                  setPlatform({...platform, category});
                }}
              />
            );
          })}
        </PlatformList>
        {platformList.length === 0 && (
          <EmptyMessage
            icon={<IconProject size="xl" />}
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
                      this.setState({filter: otherPlatform.name});
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
  border: 1px solid ${p => p.theme.gray200};
  border-radius: ${p => p.theme.borderRadius};
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
  icon: <IconClose isCircled />,
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
  cursor: pointer;

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
