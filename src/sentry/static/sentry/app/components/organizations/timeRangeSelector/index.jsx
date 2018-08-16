import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import styled from 'react-emotion';
import {Flex} from 'grid-emotion';

import DropdownLink from 'app/components/dropdownLink';
import Button from 'app/components/buttons/button';
import DynamicWrapper from 'app/components/dynamicWrapper';
import {t} from 'app/locale';

import AbsoluteSelector from './absoluteSelector';
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

  formatDate(date) {
    return moment(date).format('MMMM D, h:mm a');
  }

  render() {
    const {
      className,
      start,
      end,
      relative,
      showAbsolute,
      showRelative,
      onChange,
      onUpdate,
    } = this.props;
    // Currently we will only show either absolute or relative selector, with "absolute" taking precedence
    // Maybe an ideal selector would allow the user to choose between the two if both types of dates were allowed
    const shouldShowAbsolute = showAbsolute || !showRelative;
    const shouldShowRelative = !showAbsolute && showRelative;

    const summary = shouldShowAbsolute
      ? `${this.formatDate(start)} to ${this.formatDate(end)}`
      : `${ALLOWED_RELATIVE_DATES[relative]}`;

    return (
      <Flex direction="column" justify="center" className={className}>
        <Label>{t('Time range')}</Label>
        <DropdownLink
          title={<DynamicWrapper value={summary} fixed="start to end" />}
          keepMenuOpen={true}
          anchorRight={true}
        >
          <Flex direction="column">
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

            <div>
              <Button onClick={onUpdate}>{t('Update')}</Button>
            </div>
          </Flex>
        </DropdownLink>
      </Flex>
    );
  }
}

const StyledTimeRangeSelector = styled(TimeRangeSelector)`
  text-align: right;

  .dropdown-actor-title {
    font-size: 15px;
    height: auto;
    color: ${p => p.theme.button.default.colorActive};
  }
`;

const Label = styled('label')`
  font-weight: 400;
  font-size: 13px;
  color: ${p => p.theme.gray6};
  margin-bottom: 12px;
`;

export default StyledTimeRangeSelector;
