import {Component, createRef, Fragment} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {InlineContainer, SectionHeading} from 'app/components/charts/styles';
import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';
import DropdownBubble from 'app/components/dropdownBubble';
import DropdownButton from 'app/components/dropdownButton';
import {DropdownItem} from 'app/components/dropdownControl';
import DropdownMenu from 'app/components/dropdownMenu';
import Tooltip from 'app/components/tooltip';
import Truncate from 'app/components/truncate';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {SelectValue} from 'app/types';

const defaultProps = {
  menuWidth: 'auto',
};

type Props = {
  options: SelectValue<string>[];
  selected: string[];
  onChange: (value: string[]) => void;
  title: string;
} & typeof defaultProps;

type State = {
  menuContainerWidth?: number;
};

class OptionCheckboxSelector extends Component<Props, State> {
  static defaultProps = defaultProps;

  state: State = {};

  componentDidMount() {
    this.setMenuContainerWidth();
  }

  shouldComponentUpdate(nextProps: Props, nextState: State) {
    return !isEqual(nextProps, this.props) || !isEqual(nextState, this.state);
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.selected !== this.props.selected) {
      this.setMenuContainerWidth();
    }
  }

  setMenuContainerWidth() {
    const menuContainerWidth = this.menuContainerRef?.current?.offsetWidth;
    if (menuContainerWidth) {
      this.setState({menuContainerWidth});
    }
  }

  constructNewSelected(value: string) {
    const {selected} = this.props;
    // Cannot have no option selected
    if (selected.length === 1 && selected[0] === value) {
      return selected;
    }
    // Check if the value is already selected.
    // Return a new updated array with the value either selected or deselected depending on previous selected state.
    if (selected.includes(value)) {
      return selected.filter(selectedValue => selectedValue !== value);
    }
    return [...selected, value];
  }

  menuContainerRef = createRef<HTMLDivElement>();

  render() {
    const {menuContainerWidth} = this.state;
    const {options, onChange, selected, title, menuWidth} = this.props;
    const selectedOption =
      options.find(opt => selected.includes(opt.value)) || options[0];

    return (
      <InlineContainer>
        <SectionHeading>{title}</SectionHeading>
        <MenuContainer ref={this.menuContainerRef}>
          <DropdownMenu alwaysRenderMenu={false} keepMenuOpen>
            {({isOpen, getMenuProps, getActorProps}) => (
              <Fragment>
                <StyledDropdownButton {...getActorProps()} size="zero" isOpen={isOpen}>
                  <TruncatedLabel>{String(selectedOption.label)}</TruncatedLabel>
                </StyledDropdownButton>
                <StyledDropdownBubble
                  {...getMenuProps()}
                  alignMenu="right"
                  width={menuWidth}
                  minWidth={menuContainerWidth}
                  isOpen={isOpen}
                  blendWithActor={false}
                  blendCorner
                >
                  {options.map(opt => (
                    <StyledDropdownItem
                      key={opt.value}
                      onSelect={eventKey => onChange(this.constructNewSelected(eventKey))}
                      eventKey={opt.value}
                      disabled={opt.disabled}
                      data-test-id={`option-${opt.value}`}
                      isChecked={selected.includes(opt.value)}
                    >
                      <StyledTooltip title={opt.tooltip}>
                        <StyledTruncate
                          isActive={false}
                          value={String(opt.label)}
                          maxLength={60}
                          expandDirection="left"
                        />
                      </StyledTooltip>
                      <CheckboxFancy isChecked={selected.includes(opt.value)} />
                    </StyledDropdownItem>
                  ))}
                </StyledDropdownBubble>
              </Fragment>
            )}
          </DropdownMenu>
        </MenuContainer>
      </InlineContainer>
    );
  }
}

const TruncatedLabel = styled('span')`
  ${overflowEllipsis};
  max-width: 400px;
`;

const StyledTruncate = styled(Truncate)<{
  isActive: boolean;
}>`
  & span {
    ${p =>
      p.isActive &&
      `
      color: ${p.theme.white};
      background: ${p.theme.active};
      border: none;
    `}
  }
`;

const MenuContainer = styled('div')`
  display: inline-block;
  position: relative;
`;

const StyledDropdownButton = styled(DropdownButton)`
  padding: ${space(1)} ${space(2)};
  font-weight: normal;
  z-index: ${p => (p.isOpen ? p.theme.zIndex.dropdownAutocomplete.actor : 'auto')};
`;

const StyledDropdownBubble = styled(DropdownBubble)<{
  isOpen: boolean;
  minWidth?: number;
}>`
  display: ${p => (p.isOpen ? 'block' : 'none')};
  overflow: visible;
  ${p =>
    p.minWidth && p.width === 'auto' && `min-width: calc(${p.minWidth}px + ${space(3)})`};
`;

const StyledDropdownItem = styled(DropdownItem)<{isChecked?: boolean}>`
  line-height: ${p => p.theme.text.lineHeightBody};
  white-space: nowrap;
  ${CheckboxFancy} {
    opacity: ${p => (p.isChecked ? 1 : 0.3)};
  }

  &:hover ${CheckboxFancy} {
    opacity: 1;
  }
`;

const StyledTooltip = styled(Tooltip)`
  flex: auto;
  margin-right: ${space(2)};
`;

export default OptionCheckboxSelector;
