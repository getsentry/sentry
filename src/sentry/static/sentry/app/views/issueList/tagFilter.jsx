import debounce from 'lodash/debounce';
import PropTypes from 'prop-types';
import React from 'react';

import {Client} from 'app/api';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import SelectControl from 'app/components/forms/selectControl';

class IssueListTagFilter extends React.Component {
  static tagValueToSelectFormat = ({value}) => ({
    value,
    label: value,
  });

  static propTypes = {
    tag: PropTypes.object.isRequired,
    value: PropTypes.string,
    onSelect: PropTypes.func,
    tagValueLoader: PropTypes.func.isRequired,
  };

  static defaultProps = {
    tag: {},
    value: '',
  };

  constructor(...args) {
    super(...args);
    this.state = {
      query: '',
      isLoading: false,
      value: this.props.value,
      textValue: this.props.value,
    };
    this.api = new Client();
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (nextProps.value !== this.state.value) {
      this.setState({
        value: nextProps.value,
        textValue: nextProps.value,
      });
    }
  }

  componentWillUnmount() {
    if (!this.api) {
      return;
    }
    this.api.clear();
  }

  handleLoadOptions = () => {
    const {tag, tagValueLoader} = this.props;
    const {textValue} = this.state;
    if (tag.isInput || tag.predefined) {
      return;
    }
    if (!this.api) {
      return;
    }

    this.setState({
      isLoading: true,
    });

    tagValueLoader(tag.key, textValue)
      .then(resp => {
        this.setState({
          isLoading: false,
          options: Object.values(resp).map(IssueListTagFilter.tagValueToSelectFormat),
        });
      })
      .catch(() => {
        // TODO(billy): This endpoint seems to timeout a lot,
        // should we log these errors into datadog?

        addErrorMessage(
          tct('Unable to retrieve values for tag [tagName]', {
            tagName: textValue,
          })
        );
      });
  };

  handleChangeInput = e => {
    const value = e.target.value;
    this.setState({
      textValue: value,
    });
    this.debouncedTextChange(value);
  };

  debouncedTextChange = debounce(function(text) {
    this.handleChange(text);
  }, 150);

  handleOpenMenu = () => {
    if (this.props.tag.predefined) {
      return;
    }

    this.setState(
      {
        isLoading: true,
      },
      this.handleLoadOptions
    );
  };

  handleChangeSelect = valueObj => {
    const value = valueObj ? valueObj.value : null;
    this.handleChange(value);
  };

  handleChangeSelectInput = value => {
    this.setState(
      {
        textValue: value,
      },
      this.handleLoadOptions
    );
  };

  handleChange = value => {
    const {onSelect, tag} = this.props;

    this.setState(
      {
        value,
      },
      () => {
        onSelect && onSelect(tag, value);
      }
    );
  };

  render() {
    const {tag} = this.props;
    return (
      <div className="stream-tag-filter">
        <h6 className="nav-header">{tag.key}</h6>

        {!!tag.isInput && (
          <input
            className="form-control"
            type="text"
            value={this.state.textValue}
            onChange={this.handleChangeInput}
          />
        )}

        {!tag.isInput && (
          <SelectControl
            deprecatedSelectControl
            clearable
            filterOptions={options => options}
            placeholder="--"
            value={this.state.value}
            onChange={this.handleChangeSelect}
            isLoading={this.state.isLoading}
            onInputChange={this.handleChangeSelectInput}
            onOpen={this.handleOpenMenu}
            autoload={false}
            noResultsText={this.state.isLoading ? t('Loading...') : t('No results found')}
            options={
              tag.predefined
                ? tag.values &&
                  tag.values.map(value => ({
                    value,
                    label: value,
                  }))
                : this.state.options
            }
          />
        )}
      </div>
    );
  }
}

export default IssueListTagFilter;
