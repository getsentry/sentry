import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Flex, Box} from 'grid-emotion';

import Link from 'app/components/link';
import TextField from 'app/components/forms/textField';

import {t} from 'app/locale';

export default class Aggregations extends React.Component {
  static propTypes = {
    value: PropTypes.array.isRequired,
    onChange: PropTypes.func.isRequired,
  };

  addRow() {
    this.props.onChange([...this.props.value, ['', '', '']]);
  }

  removeRow(idx) {
    const aggregations = this.props.value.slice();
    aggregations.splice(idx, 1);
    this.props.onChange(aggregations);
  }

  updateAggregation(idx, conditionIdx, val) {
    const conditions = this.props.value.slice();

    conditions[conditionIdx][idx] = val;

    this.props.onChange(conditions);
  }

  renderAggregation(aggregation, idx) {
    return (
      <React.Fragment>
        <Box w={1 / 3} pr={1}>
          <TextField
            name="aggregations-1"
            value={aggregation[0]}
            onChange={val => this.updateAggregation(0, idx, val)}
          />
        </Box>
        <Box w={1 / 3} pr={1}>
          <TextField
            name="aggregations-2"
            value={aggregation[1]}
            onChange={val => this.updateAggregation(1, idx, val)}
          />
        </Box>
        <Box w={1 / 3} pr={1}>
          <TextField
            name="aggregations-3"
            value={aggregation[2]}
            onChange={val => this.updateAggregation(2, idx, val)}
          />
        </Box>
        <Box>
          <a
            className="icon-circle-cross"
            style={{lineHeight: '37px'}}
            onClick={() => this.removeRow(idx)}
          />
        </Box>
      </React.Fragment>
    );
  }

  render() {
    const {value} = this.props;

    return (
      <div>
        <div>
          <strong>{t('Aggregations')}</strong>
          <Add>
            (<Link onClick={() => this.addRow()}>{t('Add')}</Link>)
          </Add>
        </div>
        {!value.length && 'None'}
        {value.map((aggregation, idx) => (
          <Flex key={idx}>{this.renderAggregation(aggregation, idx)}</Flex>
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
