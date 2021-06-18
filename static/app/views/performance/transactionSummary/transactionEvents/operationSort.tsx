import {Component, ComponentClass, ReactPortal} from 'react';
import ReactDOM from 'react-dom';
import {Manager, Popper, Reference} from 'react-popper';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location, LocationDescriptorObject} from 'history';
import * as PopperJS from 'popper.js';

import {GetActorPropsFn} from 'app/components/dropdownMenu';
import MenuItem from 'app/components/menuItem';
import Radio from 'app/components/radio';
import {t} from 'app/locale';
import {TableData} from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';

export type TitleProps = Partial<ReturnType<GetActorPropsFn>>;

type Props = {
  title: ComponentClass<TitleProps>;
  eventView: EventView;
  tableMeta: TableData['meta'];
  location: Location;
};

type State = {
  isOpen: boolean;
};

class OperationSort extends Component<Props, State> {
  constructor(props: Props) {
    super(props);

    let portal = document.getElementById('team-key-transaction-portal');
    if (!portal) {
      portal = document.createElement('div');
      portal.setAttribute('id', 'team-key-transaction-portal');
      document.body.appendChild(portal);
    }
    this.portalEl = portal;
    this.menuEl = null;
  }

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
    this.portalEl.remove();
  }

  private portalEl: Element;
  private menuEl: Element | null;

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

  renderMenuContent() {
    const {eventView, tableMeta, location} = this.props;

    function generateSortLink(field): LocationDescriptorObject | undefined {
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

    return (
      <DropdownContent>
        <DropdownMenuItem>
          <MenuItemContent>
            <RadioLabel key="http">
              <StyledRadio
                readOnly
                radioSize="small"
                checked={location.query.sort === '-spans.http'}
                onClick={() => {
                  const sortLink = generateSortLink({field: 'spans.http'});
                  if (sortLink) browserHistory.push(sortLink);
                }}
              />
              <span>{t('Sort By HTTP')}</span>
            </RadioLabel>
          </MenuItemContent>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <MenuItemContent>
            <RadioLabel>
              <StyledRadio
                readOnly
                radioSize="small"
                checked={location.query.sort === '-spans.db'}
                onClick={() => {
                  const sortLink = generateSortLink({field: 'spans.db'});
                  if (sortLink) browserHistory.push(sortLink);
                }}
              />
              <span>{t('Sort By DB')}</span>
            </RadioLabel>
          </MenuItemContent>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <MenuItemContent>
            <RadioLabel>
              <StyledRadio
                readOnly
                radioSize="small"
                checked={location.query.sort === '-spans.resource'}
                onClick={() => {
                  const sortLink = generateSortLink({field: 'spans.resource'});
                  if (sortLink) browserHistory.push(sortLink);
                }}
              />
              <span>{t('Sort By Resources')}</span>
            </RadioLabel>
          </MenuItemContent>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <MenuItemContent>
            <RadioLabel>
              <StyledRadio
                readOnly
                radioSize="small"
                checked={location.query.sort === '-spans.browser'}
                onClick={() => {
                  const sortLink = generateSortLink({field: 'spans.browser'});
                  if (sortLink) browserHistory.push(sortLink);
                }}
              />
              <span>{t('Sort By Browser')}</span>
            </RadioLabel>
          </MenuItemContent>
        </DropdownMenuItem>
      </DropdownContent>
    );
  }

  renderMenu() {
    const modifiers: PopperJS.Modifiers = {
      hide: {
        enabled: false,
      },
      preventOverflow: {
        padding: 10,
        enabled: true,
        boundariesElement: 'viewport',
      },
    };

    return ReactDOM.createPortal(
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
      this.portalEl
    );
  }

  render() {
    const {title: Title} = this.props;
    const {isOpen} = this.state;
    const menu: ReactPortal | null = isOpen ? this.renderMenu() : null;

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
  box-shadow: 0 0 0 1px rgba(52, 60, 69, 0.2), 0 1px 3px rgba(70, 82, 98, 0.25);
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
  color: ${p => p.theme.gray500};
`;

const RadioLabel = styled('label')`
  display: grid;
  cursor: pointer;
  grid-gap: 0.25em 0.5em;
  grid-template-columns: max-content auto;
  -webkit-align-items: center;
  -webkit-box-align: center;
  -ms-flex-align: center;
  align-items: center;
  cursor: pointer;
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
