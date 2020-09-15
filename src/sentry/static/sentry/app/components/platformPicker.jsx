import debounce from 'lodash/debounce';
import PropTypes from 'prop-types';
import React from 'react';
import keydown from 'react-keydown';
import styled from '@emotion/styled';

import {analytics} from 'app/utils/analytics';
import {inputStyles} from 'app/styles/input';
import {t, tct} from 'app/locale';
import Button from 'app/components/button';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ExternalLink from 'app/components/links/externalLink';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import PlatformIcon from 'app/components/platformIcon';
import categoryList from 'app/data/platformCategories';
import platforms from 'app/data/platforms';
import space from 'app/styles/space';
import {IconClose, IconSearch, IconProject} from 'app/icons';

const PLATFORM_CATEGORIES = categoryList.concat({id: 'all', name: t('All')});

class PlatformPicker extends React.Component {
  static propTypes = {
    setPlatform: PropTypes.func.isRequired,
    platform: PropTypes.string,
    showOther: PropTypes.bool,
    listClassName: PropTypes.string,
    listProps: PropTypes.object,
    noAutoFilter: PropTypes.bool,
  };

  static defaultProps = {
    showOther: true,
  };

  state = {
    category: PLATFORM_CATEGORIES[0].id,
    filter: this.props.noAutoFilter ? '' : (this.props.platform || '').split('-')[0],
  };

  get platformList() {
    const {category} = this.state;
    const currentCategory = categoryList.find(({id}) => id === category);

    const subsetMatch = ({id}) => id.includes(this.state.filter.toLowerCase());
    const categoryMatch = platform =>
      category === 'all' || currentCategory.platforms.includes(platform.id);

    const filtered = platforms.filter(this.state.filter ? subsetMatch : categoryMatch);

    return this.props.showOther ? filtered : filtered.filter(({id}) => id !== 'other');
  }

  logSearch = debounce(() => {
    if (this.state.filter) {
      analytics('platformpicker.search', {
        query: this.state.filter.toLowerCase(),
        num_results: this.platformList.length,
      });
    }
  }, 300);

  @keydown('/')
  focusSearch(e) {
    if (e.target !== this.searchInput.current) {
      this.searchInput.current.focus();
      e.preventDefault();
    }
  }

  searchInput = React.createRef();

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
                onClick={e => {
                  analytics('platformpicker.select_tab', {category: id});
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
              label={t('Filter Platforms')}
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
              onClear={e => {
                setPlatform('');
                e.stopPropagation();
              }}
              onClick={() => {
                analytics('platformpicker.select_platform', {platform: platform.id});
                setPlatform(platform.id);
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
  border-bottom: 1px solid ${p => p.theme.borderLight};
  margin-bottom: ${space(2)};
  display: grid;
  grid-template-columns: 1fr 300px;
  align-items: start;
`;

const SearchBar = styled('div')`
  ${inputStyles};
  padding: 0 8px;
  color: ${p => p.theme.gray600};
  display: flex;
  align-items: center;
  font-size: 15px;

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
`;

const PlatformList = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
  grid-template-columns: repeat(auto-fill, 112px);
  margin-bottom: ${space(2)};
`;

const StyledPlatformIcon = styled(PlatformIcon)`
  width: 56px;
  height: 56px;
  font-size: 42px;
  line-height: 58px;
  text-align: center;
  margin: ${space(2)};
  border-radius: 5px;
`;

const ClearButton = styled(p => (
  <Button {...p} icon={<IconClose isCircled size="xs" />} size="xsmall" borderless />
))`
  position: absolute;
  top: -6px;
  right: -6px;
  height: 22px;
  width: 22px;
  border-radius: 50%;
  background: #fff;
  color: ${p => p.theme.gray700};
`;

const PlatformCard = styled(({platform, selected, onClear, ...props}) => (
  <div {...props}>
    <StyledPlatformIcon platform={platform.id} size="lg" />

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
  background: ${p => p.selected && '#ecf5fd'};

  &:hover {
    background: #ebebef;
  }

  h3 {
    display: block;
    width: 100%;
    text-align: center;
    font-size: 15px;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    line-height: 1.2;
  }
`;

export default PlatformPicker;
