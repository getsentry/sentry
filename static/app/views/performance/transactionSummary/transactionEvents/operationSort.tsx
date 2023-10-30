import {Component} from 'react';
import {createPortal} from 'react-dom';
import {Manager, Popper, Reference} from 'react-popper';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location, LocationDescriptorObject} from 'history';

import {GetActorPropsFn} from 'sentry/components/deprecatedDropdownMenu';
import MenuItem from 'sentry/components/menuItem';
import Radio from 'sentry/components/radio';
import {t} from 'sentry/locale';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';

export type TitleProps = Partial<ReturnType<GetActorPropsFn>>;

type Props = {
  eventView: EventView;
  location: Location;
  tableMeta: TableData['meta'];
  title: React.ComponentType<TitleProps>;
};

type State = {
  isOpen: boolean;
};

class OperationSort extends Component<Props, State> {
  state: State = {
    isOpen: false,
  };

  componentDidUpdate(_props: Props, prevState: State) {
    if (this.state.isOpen && prevState.isOpen === false) {
      document.addEventListener('click', this.handleClickOutside, true);
    }
    if (this.state.isOpen === false && prevState.isOpen) {
      document.removeEventListener('click', this.handleClickOutside, true);
    }
  }

  componentWillUnmount() {
    document.removeEventListener('click', this.handleClickOutside, true);
  }

  private menuEl: Element | null = null;

  handleClickOutside = (event: MouseEvent) => {
    if (!this.menuEl) {
      return;
    }
    if (!(event.target instanceof Element)) {
      return;
    }
    if (this.menuEl.contains(event.target)) {
      return;
    }
    this.setState({isOpen: false});
  };

  toggleOpen = () => {
    this.setState(({isOpen}) => ({isOpen: !isOpen}));
  };

  generateSortLink(field): LocationDescriptorObject | undefined {
    const {eventView, tableMeta, location} = this.props;
    if (!tableMeta) {
      return undefined;
    }

    const nextEventView = eventView.sortOnField(field, tableMeta, 'desc');
    const queryStringObject = nextEventView.generateQueryStringObject();

    return {
      ...location,
      query: {...location.query, sort: queryStringObject.sort},
    };
  }

  renderMenuItem(operation, title) {
    const {eventView} = this.props;
    return (
      <DropdownMenuItem>
        <MenuItemContent>
          <RadioLabel>
            <StyledRadio
              readOnly
              radioSize="small"
              checked={eventView.sorts.some(({field}) => field === operation)}
              onClick={() => {
                const sortLink = this.generateSortLink({field: operation});
                if (sortLink) {
                  browserHistory.push(sortLink);
                }
              }}
            />
            <span>{title}</span>
          </RadioLabel>
        </MenuItemContent>
      </DropdownMenuItem>
    );
  }

  renderMenuContent() {
    return (
      <DropdownContent>
        {this.renderMenuItem('spans.http', t('Sort By HTTP'))}
        {this.renderMenuItem('spans.db', t('Sort By DB'))}
        {this.renderMenuItem('spans.resource', t('Sort By Resource'))}
        {this.renderMenuItem('spans.browser', t('Sort By Browser'))}
      </DropdownContent>
    );
  }

  renderMenu() {
    const modifiers = [
      {
        name: 'hide',
        enabled: false,
      },
      {
        name: 'preventOverflow',
        enabled: true,
        options: {padding: 10},
      },
    ];

    return createPortal(
      <Popper placement="top" modifiers={modifiers}>
        {({ref: popperRef, style, placement}) => (
          <DropdownWrapper
            ref={ref => {
              (popperRef as Function)(ref);
              this.menuEl = ref;
            }}
            style={style}
            data-placement={placement}
          >
            {this.renderMenuContent()}
          </DropdownWrapper>
        )}
      </Popper>,
      document.body
    );
  }

  render() {
    const {title: Title} = this.props;
    const {isOpen} = this.state;
    const menu: React.ReactPortal | null = isOpen ? this.renderMenu() : null;

    return (
      <Manager>
        <Reference>
          {({ref}) => (
            <TitleWrapper ref={ref}>
              <Title onClick={this.toggleOpen} />
            </TitleWrapper>
          )}
        </Reference>
        {menu}
      </Manager>
    );
  }
}

const DropdownWrapper = styled('div')`
  /* Adapted from the dropdown-menu class */
  border: none;
  border-radius: 2px;
  box-shadow:
    0 0 0 1px rgba(52, 60, 69, 0.2),
    0 1px 3px rgba(70, 82, 98, 0.25);
  background-clip: padding-box;
  background-color: ${p => p.theme.background};
  width: 220px;
  overflow: visible;
  z-index: ${p => p.theme.zIndex.tooltip};

  &:before,
  &:after {
    width: 0;
    height: 0;
    content: '';
    display: block;
    position: absolute;
    right: auto;
  }

  &:before {
    border-left: 9px solid transparent;
    border-right: 9px solid transparent;
    left: calc(50% - 9px);
    z-index: -2;
  }

  &:after {
    border-left: 8px solid transparent;
    border-right: 8px solid transparent;
    left: calc(50% - 8px);
    z-index: -1;
  }

  &[data-placement*='bottom'] {
    margin-top: 9px;

    &:before {
      border-bottom: 9px solid ${p => p.theme.border};
      top: -9px;
    }

    &:after {
      border-bottom: 8px solid ${p => p.theme.background};
      top: -8px;
    }
  }

  &[data-placement*='top'] {
    margin-bottom: 9px;

    &:before {
      border-top: 9px solid ${p => p.theme.border};
      bottom: -9px;
    }

    &:after {
      border-top: 8px solid ${p => p.theme.background};
      bottom: -8px;
    }
  }
`;

const DropdownMenuItem = styled(MenuItem)`
  font-size: ${p => p.theme.fontSizeMedium};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }
`;

const MenuItemContent = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: center;
  width: 100%;
`;

const RadioLabel = styled('label')`
  display: grid;
  cursor: pointer;
  gap: 0.25em 0.5em;
  grid-template-columns: max-content auto;
  align-items: center;
  outline: none;
  font-weight: normal;
  margin: 0;
`;

const StyledRadio = styled(Radio)`
  margin: 0;
`;

const DropdownContent = styled('div')`
  max-height: 250px;
  overflow-y: auto;
`;

const TitleWrapper = styled('div')`
  cursor: pointer;
`;

export default OperationSort;
