import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';
import {InjectedRouter} from 'react-router';

import {t} from 'app/locale';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Repository} from 'app/types';

type Props = {
  repositories: Array<Repository>;
  router: InjectedRouter;
  location: Location;
  activeRepository?: Repository;
};

type State = {
  dropdownButtonWidth?: number;
};

class RepositorySwitcher extends React.PureComponent<Props, State> {
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

  dropdownButton = React.createRef<HTMLButtonElement>();
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
          <React.Fragment>
            <FilterText>{`${t('Filter')}:`}</FilterText>
            {activeRepo}
          </React.Fragment>
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
  color: ${p => p.theme.gray500};
  margin-right: ${space(0.5)};
`;

const RepoLabel = styled('div')`
  ${overflowEllipsis}
`;
