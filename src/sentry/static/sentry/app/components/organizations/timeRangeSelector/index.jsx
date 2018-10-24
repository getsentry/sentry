import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import {Flex} from 'grid-emotion';
import styled from 'react-emotion';

import Button from 'app/components/button';
import HeaderItem from 'app/components/organizations/headerItem';
import DropdownLink from 'app/components/dropdownLink';
import DynamicWrapper from 'app/components/dynamicWrapper';
import {t} from 'app/locale';

import AbsoluteSelector from './absoluteSelector';
import RelativeSelector from './relativeSelector';
import CombinedSelector from './combinedSelector';

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
    const {
      className,
      start,
      end,
      relative,
      showAbsolute,
      showRelative,
      onChange,
    } = this.props;

    const shouldShowAbsolute = showAbsolute && !showRelative;
    const shouldShowRelative = !showAbsolute && showRelative;
    const shouldShowBoth = showAbsolute && showRelative;

    const summary = relative
      ? `${ALLOWED_RELATIVE_DATES[relative]}`
      : `${this.formatDate(start)} to ${this.formatDate(end)}`;

    return (
      <HeaderItem className={className}>
        <DropdownLink
          title={<DynamicWrapper value={<Title>{summary}</Title>} fixed="start to end" />}
          anchorRight={true}
          keepMenuOpen={true}
          isOpen={this.state.isOpen}
          onOpen={() => this.setState({isOpen: true})}
          onClose={() => this.setState({isOpen: false})}
        >
          <Flex direction="column" p={2}>
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
          </Flex>
        </DropdownLink>
      </HeaderItem>
    );
  }
}

const Title = styled.span`
  padding-right: 40px;
`;

export default TimeRangeSelector;
