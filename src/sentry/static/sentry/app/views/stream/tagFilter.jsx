import PropTypes from 'prop-types';
import React from 'react';
import ReactDOM from 'react-dom';
import _ from 'lodash';

class StreamTagFilter extends React.Component {
  static propTypes = {
    tag: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    value: PropTypes.string,
    onSelect: PropTypes.func,
  };

  static tagValueToSelect2Format = key => {
    return {
      id: key,
      text: key,
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
      loading: false,
      value: this.props.value,
    };
  }

  componentDidMount() {
    let select = this.refs.select;

    let selectOpts = {
      placeholder: '--',
      allowClear: true,
    };

    if (!this.props.tag.predefined) {
      Object.assign(selectOpts, {
        initSelection: (element, callback) => {
          callback(StreamTagFilter.tagValueToSelect2Format(this.props.value));
        },
        ajax: {
          url: this.getTagValuesAPIEndpoint(),
          dataType: 'json',
          delay: 250,
          data: (term, page) => {
            return {
              query: term,
            };
          },
          results: (data, page) => {
            // parse the results into the format expected by Select2
            return {
              results: _.map(data, val =>
                StreamTagFilter.tagValueToSelect2Format(val.value)
              ),
            };
          },
          cache: true,
        },
      });
    }

    $(select)
      .select2(selectOpts)
      .select2('val', this.state.value)
      .on('change', this.onSelectValue);
  }

  componentWillReceiveProps(nextProps) {
    if (nextProps.value !== this.state.value) {
      this.setState(
        {
          value: nextProps.value,
        },
        () => {
          let select = this.refs.select;
          $(select).select2('val', this.state.value);
        }
      );
    }
  }

  componentWillUnmount() {
    let select = ReactDOM.findDOMNode(this.refs.select);
    $(select).select2('destroy');
  }

  getTagValuesAPIEndpoint = () => {
    return `/api/0/projects/${this.props.orgId}/${this.props.projectId}/tags/${this.props
      .tag.key}/values/`;
  };

  onSelectValue = evt => {
    let val = evt.target.value;
    this.setState({
      value: val,
    });

    this.props.onSelect && this.props.onSelect(this.props.tag, val);
  };

  render() {
    // NOTE: need to specify empty onChange handler on <select> - even though this
    //       will get overridden by select2 - because React will complain with
    //       a warning
    let tag = this.props.tag;
    return (
      <div className="stream-tag-filter">
        <h6 className="nav-header">{tag.key}</h6>

        {this.props.tag.predefined ? (
          <select ref="select" onChange={function() {}}>
            <option key="empty" />
            {this.props.tag.values.map(val => {
              return <option key={val}>{val}</option>;
            })}
          </select>
        ) : (
          <input type="hidden" ref="select" value={this.props.value} />
        )}
      </div>
    );
  }
}

export default StreamTagFilter;
