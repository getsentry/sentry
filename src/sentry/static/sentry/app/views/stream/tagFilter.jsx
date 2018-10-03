import {debounce} from 'lodash';
import PropTypes from 'prop-types';
import React from 'react';

import {Client} from 'app/api';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import SelectControl from 'app/components/forms/selectControl';

// TODO(billy): Update to use SelectAutocomplete when it is ported to use react-select
class StreamTagFilter extends React.Component {
  static propTypes = {
    tag: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    value: PropTypes.string,
    onSelect: PropTypes.func,
  };

  static tagValueToSelectFormat = ({value}) => {
    return {
      value,
      label: value,
    };
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

  componentWillReceiveProps(nextProps) {
    if (nextProps.value !== this.state.value) {
      this.setState({
        value: nextProps.value,
        textValue: nextProps.value,
      });
    }
  }

  componentWillUnmount() {
    if (!this.api) return;
    this.api.clear();
  }

  getTagValuesAPIEndpoint = () => {
    let {orgId, projectId, tag} = this.props;

    return `/api/0/projects/${orgId}/${projectId}/tags/${tag.key}/values/`;
  };

  handleLoadOptions = () => {
    let {tag} = this.props;
    let {textValue} = this.state;
    if (tag.isInput || tag.predefined) return;
    if (!this.api) return;

    this.setState({
      isLoading: true,
    });

    this.api
      .requestPromise(this.getTagValuesAPIEndpoint(), {
        query: {
          query: textValue,
        },
      })
      .then(resp => {
        this.setState({
          isLoading: false,
          options: Object.values(resp).map(StreamTagFilter.tagValueToSelectFormat),
        });
      })
      .catch(err => {
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
    let value = e.target.value;
    this.setState({
      textValue: value,
    });
    this.debouncedTextChange(value);
  };

  debouncedTextChange = debounce(function(text) {
    this.handleChange(text);
  }, 150);

  handleOpenMenu = () => {
    if (this.props.tag.predefined) return;

    this.setState(
      {
        isLoading: true,
      },
      this.handleLoadOptions
    );
  };

  handleChangeSelect = valueObj => {
    let value = valueObj ? valueObj.value : null;
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
    let {onSelect, tag} = this.props;

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
    let {tag} = this.props;
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
            filterOptions={(options, filter, currentValues) => options}
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

export default StreamTagFilter;
