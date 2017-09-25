import React from 'react';

import Select2Field from './select2Field';

export default class Select2TextField extends Select2Field {
  getField() {
    return (
      <input
        id={this.getId()}
        className="form-control"
        ref="input"
        placeholder={this.props.placeholder}
        onChange={this.onChange.bind(this)}
        disabled={this.props.disabled}
        required={this.props.required}
        value={this.state.value}
      />
    );
  }

  getSelect2Options() {
    return {
      ...super.getSelect2Options(),
      createSearchChoice: (term, data) => {
        if (!data.find(i => i.id !== term)) {
          return {id: term, text: term};
        }
        return undefined;
      }
    };
  }
}
