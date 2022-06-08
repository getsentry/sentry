import {createRef, Fragment, PureComponent} from 'react';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import DropdownControl, {DropdownItem} from 'sentry/components/dropdownControl';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Repository} from 'sentry/types';

type Props = {
  location: Location;
  repositories: Array<Repository>;
  router: InjectedRouter;
  activeRepository?: Repository;
};

type State = {
  dropdownButtonWidth?: number;
};

class RepositorySwitcher extends PureComponent<Props, State> {
  state: State = {};

  componentDidMount() {
    this.setButtonDropDownWidth();
  }
  setButtonDropDownWidth() {
    const dropdownButtonWidth = this.dropdownButton?.current?.offsetWidth;
    if (dropdownButtonWidth) {
      this.setState({dropdownButtonWidth});
    }
  }

  dropdownButton = createRef<HTMLButtonElement>();
  handleRepoFilterChange = (activeRepo: string) => {
    const {router, location} = this.props;

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, activeRepo},
    });
  };

  render() {
    const {activeRepository, repositories} = this.props;
    const {dropdownButtonWidth} = this.state;

    const activeRepo = activeRepository?.name;

    return (
      <StyledDropdownControl
        minMenuWidth={dropdownButtonWidth}
        label={
          <Fragment>
            <FilterText>{`${t('Filter')}:`}</FilterText>
            {activeRepo}
          </Fragment>
        }
        buttonProps={{forwardRef: this.dropdownButton}}
      >
        {repositories
          .map(repo => repo.name)
          .map(repoName => (
            <DropdownItem
              key={repoName}
              onSelect={this.handleRepoFilterChange}
              eventKey={repoName}
              isActive={repoName === activeRepo}
            >
              <RepoLabel>{repoName}</RepoLabel>
            </DropdownItem>
          ))}
      </StyledDropdownControl>
    );
  }
}

export default RepositorySwitcher;

const StyledDropdownControl = styled(DropdownControl)<{
  minMenuWidth: State['dropdownButtonWidth'];
}>`
  margin-bottom: ${space(1)};
  > *:nth-child(2) {
    right: auto;
    width: auto;
    ${p => p.minMenuWidth && `min-width: calc(${p.minMenuWidth}px + 10px);`}
    border-radius: ${p => p.theme.borderRadius};
    border-top-left-radius: 0px;
    border: 1px solid ${p => p.theme.button.default.border};
    top: calc(100% - 1px);
  }
`;

const FilterText = styled('em')`
  font-style: normal;
  color: ${p => p.theme.gray300};
  margin-right: ${space(0.5)};
`;

const RepoLabel = styled('div')`
  ${p => p.theme.overflowEllipsis}
`;
