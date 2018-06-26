import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import {Flex, Box} from 'grid-emotion';

import Link from 'app/components/link';
import {t} from 'app/locale';

import Condition from './condition';

export default class Conditions extends React.Component {
  static propTypes = {
    value: PropTypes.arrayOf(PropTypes.array).isRequired,
    onChange: PropTypes.func.isRequired,
    columns: PropTypes.array,
  };

  constructor(props) {
    super(props);
    this.state = {
      editIndex: null,
    };
  }

  addRow() {
    const idx = this.props.value.length;
    this.setState({
      editIndex: idx,
    });
    this.props.onChange([...this.props.value, [null, null, null]]);
  }

  removeRow(idx) {
    const conditions = this.props.value.slice();
    conditions.splice(idx, 1);
    this.props.onChange(conditions);
  }

  handleChange(val, idx) {
    const conditions = this.props.value.slice();

    conditions[idx] = val;

    this.props.onChange(conditions);
  }

  render() {
    const {value, columns} = this.props;

    return (
      <div>
        <div>
          <strong>{t('Conditions')}</strong>
          <Add>
            (<Link onClick={() => this.addRow()}>{t('Add')}</Link>)
          </Add>
        </div>
        {!value.length && 'None, showing all events'}
        {value.map((condition, idx) => (
          <Flex key={idx}>
            <Condition
              value={condition}
              onChange={val => this.handleChange(val, idx)}
              columns={columns}
            />
            <Box ml={1}>
              <a
                className="icon-circle-cross"
                style={{lineHeight: '37px'}}
                onClick={() => this.removeRow(idx)}
              />
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
