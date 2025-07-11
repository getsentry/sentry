import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import {PlatformIcon} from 'platformicons';

import {Button} from 'sentry/components/core/button';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingMask from 'sentry/components/loadingMask';
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

type State = {
  category: Category;
  filter: string;
};

class PlatformPicker extends Component<PlatformPickerProps, State> {
  static defaultProps = {
    showOther: true,
    visibleSelection: true,
  };

  state: State = {
    category: this.props.defaultCategory ?? categoryList[0]!.id,
    filter: this.props.noAutoFilter ? '' : (this.props.platform || '').split('-')[0]!,
  };

  componentDidUpdate(prevProps: Readonly<PlatformPickerProps>): void {
    if (this.props.defaultCategory !== prevProps.defaultCategory) {
      this.setState({category: this.props.defaultCategory ?? categoryList[0]!.id});
    }
  }

  get platformList() {
    const {category} = this.state;

    const currentCategory = categoryList.find(({id}) => id === category);

    const filter = this.state.filter.toLowerCase();

    const subsetMatch = (platform: PlatformIntegration) =>
      platform.id.includes(filter) ||
      platform.name.toLowerCase().includes(filter) ||
      filterAliases[platform.id]?.some(alias => alias.includes(filter));

    const categoryMatch = (platform: PlatformIntegration) => {
      return currentCategory?.platforms?.has(platform.id);
    };

    // temporary replacement of selectablePlatforms while `nintendo-switch` is behind feature flag
    const tempSelectablePlatforms = selectablePlatforms;

    if (this.props.organization?.features.includes('selectable-nintendo-platform')) {
      const nintendo = platforms.find(p => p.id === 'nintendo-switch');
      if (nintendo) {
        if (!tempSelectablePlatforms.includes(nintendo)) {
          tempSelectablePlatforms.push(nintendo);
        }
      }
    }

    // 'other' is not part of the createablePlatforms list, therefore it won't be included in the filtered list
    const filtered = tempSelectablePlatforms.filter(
      this.state.filter ? subsetMatch : categoryMatch
    );

    if (this.props.showOther && this.state.filter.toLocaleLowerCase() === 'other') {
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
    const {
      setPlatform,
      listProps,
      listClassName,
      navClassName,
      loading = false,
      showFilterBar = true,
    } = this.props;
    const {filter, category} = this.state;

    return (
      <Fragment>
        <NavContainer className={navClassName}>
          <TabsContainer>
            <Tabs
              value={category}
              onChange={val => {
                trackAnalytics('growth.platformpicker_category', {
                  category: val,
                  source: this.props.source,
                  organization: this.props.organization ?? null,
                });
                this.setState({category: val, filter: ''});
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
              onChange={val => this.setState({filter: val}, this.logSearch)}
            />
          )}
        </NavContainer>
        <PlatformList className={listClassName} {...listProps}>
          {platformList.map(platform => {
            return (
              <div key={platform.id} style={{position: 'relative'}}>
                <TransparentLoadingMask visible={loading} />
                <PlatformCard
                  visibleSelection={this.props.visibleSelection}
                  data-test-id={`platform-${platform.id}`}
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
              </div>
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
  border: 1px solid ${p => p.theme.border};
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
        withLanguageIcon
        format="lg"
      />
      <h3>{platform.name}</h3>
      {selected && visibleSelection && (
        <ClearButton
          icon={<IconClose isCircled />}
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
    color: ${p => (p.selected ? p.theme.textColor : p.theme.subText)};
    text-align: center;
    font-size: ${p => p.theme.fontSize.xs};
    text-transform: uppercase;
    margin: 0;
    padding: 0 ${space(0.5)};
    line-height: 1.2;
  }
`;

export default PlatformPicker;
