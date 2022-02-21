import {Component, createRef, Fragment} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {InlineContainer, SectionHeading} from 'sentry/components/charts/styles';
import DropdownBubble from 'sentry/components/dropdownBubble';
import DropdownButton from 'sentry/components/dropdownButton';
import {DropdownItem} from 'sentry/components/dropdownControl';
import DropdownMenu from 'sentry/components/dropdownMenu';
import FeatureBadge from 'sentry/components/featureBadge';
import Tooltip from 'sentry/components/tooltip';
import Truncate from 'sentry/components/truncate';
import overflowEllipsis from 'sentry/styles/overflowEllipsis';
import space from 'sentry/styles/space';
import {SelectValue} from 'sentry/types';
import {defined} from 'sentry/utils';

const defaultProps = {
  menuWidth: 'auto',
};

type Props = {
  onChange: (value: string) => void;
  options: SelectValue<string>[];
  selected: string;
  title: string;
  featureType?: 'alpha' | 'beta' | 'new';
} & typeof defaultProps;

type State = {
  menuContainerWidth?: number;
};

class OptionSelector extends Component<Props, State> {
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

  menuContainerRef = createRef<HTMLDivElement>();

  render() {
    const {menuContainerWidth} = this.state;
    const {options, onChange, selected, title, menuWidth, featureType} = this.props;
    const selectedOption = options.find(opt => selected === opt.value) || options[0];

    return (
      <InlineContainer>
        <SectionHeading>
          {title}
          {defined(featureType) ? <StyledFeatureBadge type={featureType} /> : null}
        </SectionHeading>
        <MenuContainer ref={this.menuContainerRef}>
          <DropdownMenu alwaysRenderMenu={false}>
            {({isOpen, getMenuProps, getActorProps}) => (
              <Fragment>
                <StyledDropdownButton {...getActorProps()} size="small" isOpen={isOpen}>
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
                      onSelect={onChange}
                      eventKey={opt.value}
                      disabled={opt.disabled}
                      isActive={selected === opt.value}
                      data-test-id={`option-${opt.value}`}
                    >
                      <Tooltip title={opt.tooltip} containerDisplayMode="inline">
                        <StyledTruncate
                          isActive={selected === opt.value}
                          value={String(opt.label)}
                          maxLength={60}
                          expandDirection="left"
                        />
                      </Tooltip>
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

const StyledDropdownItem = styled(DropdownItem)`
  line-height: ${p => p.theme.text.lineHeightBody};
  white-space: nowrap;
`;

const StyledFeatureBadge = styled(FeatureBadge)`
  margin-left: 0px;
`;

export default OptionSelector;
