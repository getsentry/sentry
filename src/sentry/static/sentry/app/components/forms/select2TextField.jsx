import React from 'react';

import Select2Field from 'app/components/forms/select2Field';

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
      data: (this.props.choices || []).map(choice => {
        if (Array.isArray(choice)) {
          return {id: choice[0], text: choice[1]};
        }
        return {id: choice, text: choice};
      }),
      createSearchChoice: (term, data) => {
        if (!data.find(i => i.id !== term)) {
          return {id: term, text: term};
        }
        return undefined;
      },
    };
  }
}
