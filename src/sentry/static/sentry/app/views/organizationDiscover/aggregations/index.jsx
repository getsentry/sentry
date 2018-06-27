import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Flex, Box} from 'grid-emotion';

import Link from 'app/components/link';
import SelectControl from 'app/components/forms/selectControl';
import InlineSvg from 'app/components/inlineSvg';
import {t} from 'app/locale';

import {getInternal, getExternal, getAggregateOptions} from './utils';
import {TOPK_COUNTS} from '../data';

class Aggregation extends React.Component {
  static propTypes = {
    value: PropTypes.array,
    onChange: PropTypes.func,
    columns: PropTypes.array,
  };

  constructor(props) {
    super(props);
    this.state = {
      value: getInternal(props.value),
      displayedOptions: null,
      options: getAggregateOptions(props.columns),
    };
  }

  componentWillReceiveProps(nextProps) {
    this.setState({
      value: getInternal(nextProps.value),
    });
  }

  getOptions() {
    const {options} = this.state;
    return [options.topLevel[0], ...options.uniq, ...options.topKValues];
  }

  filterOptions = (options, input, value) => {
    let optionList = this.state.options.topLevel;

    if (input.startsWith('uniq') || this.state.displayedOptions === 'uniq') {
      optionList = this.state.options.uniq;
    }

    if (input.match(/^topK_\d+/) || this.state.displayedOptions === 'topKValue') {
      optionList = this.state.options.topKValues;
    }

    if (input.startsWith('topK') || this.state.displayedOptions === 'topK') {
      optionList = this.state.options.topKCounts;
    }

    return optionList.filter(({label}) => label.includes(input));
  };

  focus() {
    this.select.focus();
  }

  handleChange = option => {
    const topKValues = new Set([...TOPK_COUNTS.map(num => `topK_${num}`)]);

    if (option.value === 'uniq' || option.value === 'topK') {
      this.setState({displayedOptions: option.value}, this.focus);
    } else if (topKValues.has(option.value)) {
      this.setState(
        {
          displayedOptions: 'topKValue',
        },
        this.focus
      );
    } else {
      this.setState({value: option.value, displayedOptions: null}, () => {
        this.props.onChange(getExternal(option.value));
      });
    }
  };

  handleClose = () => {
    this.setState({displayedOptions: null});
  };

  render() {
    return (
      <Box w={1}>
        <SelectControl
          forwardedRef={ref => (this.select = ref)}
          value={this.state.value}
          options={this.getOptions()}
          filterOptions={this.filterOptions}
          onChange={this.handleChange}
          closeOnSelect={true}
          openOnFocus={true}
          autoBlur={true}
          clearable={false}
          backspaceRemoves={false}
          deleteRemoves={false}
          onClose={this.handleClose}
        />
      </Box>
    );
  }
}

export default class Aggregations extends React.Component {
  static propTypes = {
    value: PropTypes.array.isRequired,
    onChange: PropTypes.func.isRequired,
    columns: PropTypes.array,
  };

  addRow() {
    this.props.onChange([...this.props.value, [null, null, null]]);
  }

  removeRow(idx) {
    const aggregations = this.props.value.slice();
    aggregations.splice(idx, 1);
    this.props.onChange(aggregations);
  }

  handleChange(val, idx) {
    const aggregations = this.props.value.slice();

    aggregations[idx] = val;

    this.props.onChange(aggregations);
  }

  render() {
    const {value, columns} = this.props;

    return (
      <div>
        <div>
          <strong>{t('Aggregation')}</strong>
          <Add>
            (<Link onClick={() => this.addRow()}>{t('Add')}</Link>)
          </Add>
        </div>
        {!value.length && 'None'}
        {value.map((aggregation, idx) => (
          <Flex key={idx}>
            <Aggregation
              value={aggregation}
              onChange={val => this.handleChange(val, idx)}
              columns={columns}
            />
            <Box ml={1}>
              <a onClick={() => this.removeRow(idx)}>
                <InlineSvg src="icon-circle-close" height="38px" />
              </a>
            </Box>
          </Flex>
        ))}
      </div>
    );
  }
}

const Add = styled.span`
  font-style: italic;
  text-decoration: underline;
  margin-left: 4px;
  font-size: 13px;
  line-height: 16px;
  color: ${p => p.theme.gray1};
`;
