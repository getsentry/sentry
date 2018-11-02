import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Button from 'app/components/button';
import DropdownMenu from 'app/components/dropdownMenu';
import HeaderItem from 'app/components/organizations/headerItem';
import InlineSvg from 'app/components/inlineSvg';
import getDynamicText from 'app/utils/getDynamicText';
import space from 'app/styles/space';

import AbsoluteSelector from './absoluteSelector';
import CombinedSelector from './combinedSelector';
import RelativeSelector from './relativeSelector';

const ALLOWED_RELATIVE_DATES = {
  '24h': t('Last 24 hours'),
  '7d': t('Last 7 days'),
  '14d': t('Last 14 days'),
  '30d': t('Last 30 days'),
};

class TimeRangeSelector extends React.Component {
  static propTypes = {
    /**
     * Show absolute date selectors
     */
    showAbsolute: PropTypes.bool,
    /**
     * Show relative date selectors
     */
    showRelative: PropTypes.bool,

    /**
     * Start date value for absolute date selector
     */
    start: PropTypes.string,
    /**
     * End date value for absolute date selector
     */
    end: PropTypes.string,

    /**
     * Relative date value
     */
    relative: PropTypes.string,

    /**
     * Callback when value changes
     */
    onChange: PropTypes.func,

    /**
     * Callback when "Update" button is clicked
     */
    onUpdate: PropTypes.func,
  };

  static defaultProps = {
    showAbsolute: true,
    showRelative: false,
  };

  constructor() {
    super();
    this.state = {
      isOpen: false,
    };
  }

  formatDate(date) {
    return moment(date).format('MMMM D, h:mm a');
  }

  handleUpdate = () => {
    const {onUpdate} = this.props;
    if (typeof onUpdate === 'function') {
      onUpdate();
    }
    this.setState({
      isOpen: false,
    });
  };

  render() {
    const {start, end, relative, showAbsolute, showRelative, onChange} = this.props;

    const shouldShowAbsolute = showAbsolute && !showRelative;
    const shouldShowRelative = !showAbsolute && showRelative;
    const shouldShowBoth = showAbsolute && showRelative;

    const summary = relative
      ? `${ALLOWED_RELATIVE_DATES[relative]}`
      : `${this.formatDate(start)} to ${this.formatDate(end)}`;

    return (
      <DropdownMenu
        isOpen={this.state.isOpen}
        onOpen={() => this.setState({isOpen: true})}
        onClose={() => this.setState({isOpen: false})}
        keepMenuOpen={true}
      >
        {({isOpen, getRootProps, getActorProps, getMenuProps}) => (
          <div {...getRootProps()} style={{position: 'relative'}}>
            <StyledHeaderItem
              icon={<StyledInlineSvg src="icon-calendar" />}
              isOpen={isOpen}
              hasSelected={true}
              allowClear={false}
              {...getActorProps({isStyled: true})}
            >
              {getDynamicText({value: summary, fixed: 'start to end'})}
            </StyledHeaderItem>
            <Menu
              {...getMenuProps({isStyled: true})}
              style={{display: isOpen ? 'block' : 'none'}}
            >
              {shouldShowAbsolute && (
                <AbsoluteSelector onChange={onChange} start={start} end={end} />
              )}
              {shouldShowRelative && (
                <RelativeSelector
                  choices={Object.entries(ALLOWED_RELATIVE_DATES)}
                  onChange={onChange}
                  value={relative}
                />
              )}
              {shouldShowBoth && (
                <CombinedSelector
                  choices={Object.entries(ALLOWED_RELATIVE_DATES)}
                  onChange={onChange}
                  relative={relative}
                  start={start}
                  end={end}
                />
              )}
              <div>
                <Button onClick={this.handleUpdate}>{t('Update')}</Button>
              </div>
            </Menu>
          </div>
        )}
      </DropdownMenu>
    );
  }
}

const StyledHeaderItem = styled(HeaderItem)`
  height: 100%;
  width: 230px;
`;

const StyledInlineSvg = styled(InlineSvg)`
  transform: translateY(-2px);
  height: 17px;
  width: 17px;
`;

const Menu = styled('div')`
  background: #fff;
  border: 1px solid ${p => p.theme.borderLight};
  position: absolute;
  top: 100%;
  left: -1px;
  min-width: 120%;
  z-index: ${p => p.theme.zIndex.dropdown};
  box-shadow: ${p => p.theme.dropShadowLight};
  padding: ${space(2)};
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
`;

export default TimeRangeSelector;
