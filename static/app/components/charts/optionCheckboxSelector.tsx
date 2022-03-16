import {Component, createRef, Fragment} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {InlineContainer, SectionHeading} from 'sentry/components/charts/styles';
import CheckboxFancy from 'sentry/components/checkboxFancy/checkboxFancy';
import DropdownBubble from 'sentry/components/dropdownBubble';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownItem} from 'sentry/components/dropdownControl';
import DropdownMenu from 'sentry/components/dropdownMenu';
import Tooltip from 'sentry/components/tooltip';
import Truncate from 'sentry/components/truncate';
import {t} from 'sentry/locale';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {SelectValue} from 'sentry/types';

const defaultProps = {
  menuWidth: 'auto',
};

export type OptionCheckboxSelectorProps = {
  onChange: (value: string[]) => void;
  options: (SelectValue<string> & {checkboxHidden?: boolean})[];
  selected: string[];
  title: string;
} & typeof defaultProps;

export type OptionCheckboxSelectorState = {
  menuContainerWidth?: number;
};

class OptionCheckboxSelector extends Component<
  OptionCheckboxSelectorProps,
  OptionCheckboxSelectorState
> {
  static defaultProps = defaultProps;

  state: OptionCheckboxSelectorState = {};

  componentDidMount() {
    this.setMenuContainerWidth();
  }

  shouldComponentUpdate(
    nextProps: OptionCheckboxSelectorProps,
    nextState: OptionCheckboxSelectorState
  ) {
    return !isEqual(nextProps, this.props) || !isEqual(nextState, this.state);
  }

  componentDidUpdate(prevProps: OptionCheckboxSelectorProps) {
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
    return [value];
  }

  selectCheckbox(value: string) {
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

  shouldBeDisabled({value, disabled}: SelectValue<string>) {
    const {selected} = this.props;
    // Y-Axis is capped at 3 fields
    return disabled || (selected.length > 2 && !selected.includes(value));
  }

  handleCheckboxClick(event: React.MouseEvent, opt: SelectValue<string>) {
    const {onChange} = this.props;
    event.stopPropagation();
    if (!this.shouldBeDisabled(opt)) {
      onChange(this.selectCheckbox(opt.value));
    }
  }

  menuContainerRef = createRef<HTMLDivElement>();

  render() {
    const {menuContainerWidth} = this.state;
    const {options, onChange, selected, title, menuWidth} = this.props;
    const selectedOptionLabel =
      options
        .filter(opt => selected.includes(opt.value))
        .map(({label}) => label)
        .join(', ') || 'None';

    return (
      <InlineContainer>
        <SectionHeading>{title}</SectionHeading>
        <MenuContainer ref={this.menuContainerRef}>
          <DropdownMenu alwaysRenderMenu={false} keepMenuOpen>
            {({isOpen, getMenuProps, getActorProps}) => (
              <Fragment>
                <StyledDropdownButton {...getActorProps()} size="zero" isOpen={isOpen}>
                  <TruncatedLabel>{String(selectedOptionLabel)}</TruncatedLabel>
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
                  {options.map(opt => {
                    const disabled = this.shouldBeDisabled(opt);
                    return (
                      <StyledDropdownItem
                        key={opt.value}
                        onSelect={eventKey =>
                          onChange(this.constructNewSelected(eventKey))
                        }
                        eventKey={opt.value}
                        data-test-id={`option-${opt.value}`}
                        isChecked={selected.includes(opt.value)}
                      >
                        <StyledTruncate
                          isActive={false}
                          value={String(opt.label)}
                          maxLength={60}
                          expandDirection="left"
                        />
                        {!opt.checkboxHidden && (
                          <Tooltip
                            title={
                              disabled
                                ? t(
                                    opt.tooltip ??
                                      'Only a maximum of 3 fields can be displayed on the Y-Axis at a time'
                                  )
                                : undefined
                            }
                          >
                            <CheckboxFancy
                              className={opt.value}
                              isChecked={selected.includes(opt.value)}
                              isDisabled={disabled}
                              onClick={event => this.handleCheckboxClick(event, opt)}
                            />
                          </Tooltip>
                        )}
                      </StyledDropdownItem>
                    );
                  })}
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
  flex: auto;
  padding-right: ${space(1)};
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

export default OptionCheckboxSelector;
