import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Flex, Box} from 'grid-emotion';

import Link from 'app/components/link';
import SelectControl from 'app/components/forms/selectControl';
import InlineSvg from 'app/components/inlineSvg';
import {t} from 'app/locale';

import {COLUMNS} from './data';

const COUNT_OPTION = {value: 'count', label: 'count'};

const TOPK_COUNTS = [5, 10, 20, 50, 100];

const TOP_LEVEL_OPTIONS = [
  {value: 'uniq', label: 'uniq(...)'},
  {value: 'topK', label: 'topK(...)'},
];

const UNIQ_OPTIONS = COLUMNS.map(({name}) => ({
  value: `uniq_${name}`,
  label: `uniq(${name})`,
}));

const TOPK_COUNT_OPTIONS = TOPK_COUNTS.map(num => ({
  value: `topK_${num}`,
  label: `topK(${num})(...)`,
}));

const TOPK_VALUE_OPTIONS = TOPK_COUNTS.reduce((acc, num) => {
  return [
    ...acc,
    ...COLUMNS.map(({name}) => ({
      value: `topK_${num}_${name}`,
      label: `topK(${num})(${name})`,
    })),
  ];
}, []);

/*
* Converts from external representation (array) to internal format (string)
* for dropdown.
*/
export function getInternal(external) {
  const [func, col] = external;

  if (func === null) {
    return '';
  }

  if (func === 'count()') {
    return 'count';
  }

  if (func === 'uniq') {
    return `uniq_${col}`;
  }

  if (func.startsWith('topK')) {
    const count = func.match(/topK\((\d+)\)/)[1];
    return `topK_${count}_${col}`;
  }

  return func;
}

/*
* Converts from external representation (string value from dropdown) to external format (array)
*/
export function getExternal(internal) {
  const uniqRegex = /^uniq_(.+)$/;
  const topKRegex = /^topK_(\d+)_(.+)$/;

  if (internal === 'count') {
    return ['count()', null, 'count'];
  }

  if (internal.match(uniqRegex)) {
    return ['uniq', internal.match(uniqRegex)[1], internal];
  }

  const topKMatch = internal.match(topKRegex);
  if (topKMatch) {
    return [`topK(${parseInt(topKMatch[1], 10)})`, topKMatch[2], internal];
  }

  return internal;
}

class Aggregation extends React.Component {
  static propTypes = {
    value: PropTypes.array,
    onChange: PropTypes.func,
  };

  constructor(props) {
    super(props);
    this.state = {
      value: getInternal(props.value),
      displayedOptions: null,
    };
  }

  componentWillReceiveProps(nextProps) {
    this.setState({
      value: getInternal(nextProps.value),
    });
  }

  getOptions() {
    return [COUNT_OPTION, ...UNIQ_OPTIONS, ...TOPK_VALUE_OPTIONS];
  }

  getOptionList(options, input) {}

  filterOptions = (options, input, value) => {
    let optionList = [COUNT_OPTION, ...TOP_LEVEL_OPTIONS];

    if (input.startsWith('uniq') || this.state.displayedOptions === 'uniq') {
      optionList = UNIQ_OPTIONS;
    }

    if (input.match(/^topK_\d+/) || this.state.displayedOptions === 'topKValues') {
      optionList = TOPK_VALUE_OPTIONS;
    }

    if (input.startsWith('topK') || this.state.displayedOptions === 'topK') {
      optionList = TOPK_COUNT_OPTIONS;
    }

    return optionList.filter(({label}) => label.includes(input));
  };

  focus() {
    this.select.focus();
  }

  handleChange = option => {
    const topLevelValues = new Set(['uniq', 'topK']);
    const topKValues = new Set([...TOPK_COUNTS.map(num => `topK_${num}`)]);

    if (topLevelValues.has(option.value)) {
      this.setState({displayedOptions: option.value}, this.focus);
    } else if (topKValues.has(option.value)) {
      this.setState(
        {
          displayedOptions: 'topKValues',
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
    const {value} = this.props;

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
