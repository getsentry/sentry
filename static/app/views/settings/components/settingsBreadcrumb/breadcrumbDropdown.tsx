import {Component} from 'react';

import DropdownAutoCompleteMenu from 'sentry/components/dropdownAutoComplete/menu';
import {Item} from 'sentry/components/dropdownAutoComplete/types';
import Crumb from 'sentry/views/settings/components/settingsBreadcrumb/crumb';
import Divider from 'sentry/views/settings/components/settingsBreadcrumb/divider';

import {RouteWithName} from './types';

const EXIT_DELAY = 0;

interface AdditionalDropdownProps
  extends Pick<
    React.ComponentProps<typeof DropdownAutoCompleteMenu>,
    'onChange' | 'busyItemsStillVisible'
  > {}

export interface BreadcrumbDropdownProps extends AdditionalDropdownProps {
  items: Item[];
  name: React.ReactNode;
  onSelect: (item: Item) => void;
  route: RouteWithName;
  enterDelay?: number;
  hasMenu?: boolean;
  isLast?: boolean;
}

type State = {
  isOpen: boolean;
};

class BreadcrumbDropdown extends Component<BreadcrumbDropdownProps, State> {
  state: State = {
    isOpen: false,
  };

  componentWillUnmount() {
    window.clearTimeout(this.enteringTimeout);
    window.clearTimeout(this.leavingTimeout);
  }

  enteringTimeout: number | undefined = undefined;
  leavingTimeout: number | undefined = undefined;

  open = () => {
    this.setState({isOpen: true});
  };

  close = () => {
    this.setState({isOpen: false});
  };

  handleStateChange = () => {};

  // Adds a delay when mouse hovers on actor (in this case the breadcrumb)
  handleMouseEnterActor = () => {
    window.clearTimeout(this.leavingTimeout);
    window.clearTimeout(this.enteringTimeout);

    this.enteringTimeout = window.setTimeout(
      () => this.open(),
      this.props.enterDelay ?? 0
    );
  };

  // handles mouseEnter event on actor and menu, should clear the leaving timeout and keep menu open
  handleMouseEnter = () => {
    window.clearTimeout(this.leavingTimeout);
    window.clearTimeout(this.enteringTimeout);
    this.open();
  };

  // handles mouseLeave event on actor and menu, adds a timeout before updating state to account for
  // mouseLeave into
  handleMouseLeave = () => {
    window.clearTimeout(this.enteringTimeout);
    this.leavingTimeout = window.setTimeout(() => this.close(), EXIT_DELAY);
  };

  // Close immediately when actor is clicked clicked
  handleClickActor = () => {
    this.close();
  };

  // Close immediately when clicked outside
  handleClose = () => {
    this.close();
  };

  render() {
    const {hasMenu, route, isLast, name, items, onSelect, ...dropdownProps} = this.props;
    return (
      <DropdownAutoCompleteMenu
        blendCorner={false}
        onOpen={this.handleMouseEnter}
        onClose={this.close}
        isOpen={this.state.isOpen}
        menuProps={{
          onMouseEnter: this.handleMouseEnter,
          onMouseLeave: this.handleMouseLeave,
        }}
        items={items}
        onSelect={onSelect}
        virtualizedHeight={41}
        {...dropdownProps}
      >
        {({getActorProps, actions, isOpen}) => (
          <Crumb
            {...getActorProps({
              onClick: this.handleClickActor.bind(this, actions),
              onMouseEnter: this.handleMouseEnterActor.bind(this, actions),
              onMouseLeave: this.handleMouseLeave.bind(this, actions),
            })}
          >
            <span>{name || route.name} </span>
            <Divider isHover={hasMenu && isOpen} isLast={isLast} />
          </Crumb>
        )}
      </DropdownAutoCompleteMenu>
    );
  }
}

export default BreadcrumbDropdown;
