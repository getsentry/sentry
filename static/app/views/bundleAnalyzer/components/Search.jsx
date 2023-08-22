import {Component} from 'react';
import debounce from 'lodash.debounce';

import Button from './Button';
import s from './Search.css';

export default class Search extends Component {
  componentDidMount() {
    if (this.props.autofocus) {
      this.focus();
    }
  }

  componentWillUnmount() {
    this.handleValueChange.cancel();
  }

  handleValueChange = debounce(event => {
    this.informChange(event.target.value);
  }, 400);

  handleInputBlur = () => {
    this.handleValueChange.flush();
  };

  handleClearClick = () => {
    this.clear();
    this.focus();
  };

  handleKeyDown = event => {
    let handled = true;

    switch (event.key) {
      case 'Escape':
        this.clear();
        break;
      case 'Enter':
        this.handleValueChange.flush();
        break;
      default:
        handled = false;
    }

    if (handled) {
      event.stopPropagation();
    }
  };

  focus() {
    if (this.input) {
      this.input.focus();
    }
  }

  clear() {
    this.handleValueChange.cancel();
    this.informChange('');
    this.input.value = '';
  }

  informChange(value) {
    this.props.onQueryChange(value);
  }

  saveInputNode = node => (this.input = node);

  render() {
    const {label, query} = this.props;

    return (
      <div className={s.container}>
        <div className={s.label}>{label}:</div>
        <div className={s.row}>
          <input
            ref={this.saveInputNode}
            className={s.input}
            type="text"
            value={query}
            placeholder="Enter regexp"
            onInput={this.handleValueChange}
            onBlur={this.handleInputBlur}
            onKeyDown={this.handleKeyDown}
          />
          <Button className={s.clear} onClick={this.handleClearClick}>
            x
          </Button>
        </div>
      </div>
    );
  }
}
