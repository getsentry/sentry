import React from "react";
import _ from "underscore";

var StreamTagFilter = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  propTypes: {
    tag: React.PropTypes.object.isRequired
  },

  getDefaultProps() {
    return {
      tag: {},
      value: null
    };
  },

  getInitialState() {
    return {
      query: '',
      loading: false,
      value: this.props.value,
    };
  },

  statics: {
    tagValueToSelect2Format: (key) => {
      return {
        id: key,
        text: key
      };
    }
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.value !== this.state.value) {
      this.setState({
        value: nextProps.value
      }, () => {
        let select = this.refs.select.getDOMNode();
        $(select).select2('val', this.state.value);
      });
    }
  },

  componentDidMount() {
    let select = this.refs.select.getDOMNode();

    let selectOpts = {
      placeholder: '--',
      allowClear: true
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
              query: term
            };
          },
          results: (data, page) => {
            // parse the results into the format expected by Select2
            return {
              results: _.map(data, (val) => StreamTagFilter.tagValueToSelect2Format(val.value))
            };
          },
          cache: true
        }
      });
    }

    $(select)
      .select2(selectOpts)
      .on('change', this.onSelectValue);
  },

  componentWillUnmount() {
    let select = this.refs.select.getDOMNode();
    $(select).select2('destroy');
  },

  getTagValuesAPIEndpoint() {
    let params = this.context.router.getCurrentParams();
    return `/api/0/projects/${params.orgId}/${params.projectId}/tags/${this.props.tag.key}/values/`;
  },

  onSelectValue(evt) {
    let val = evt.target.value;
    this.setState({
      value: val
    });

    this.props.onSelect && this.props.onSelect(this.props.tag, val);
  },

  render() {
    let tag = this.props.tag;
    return (
      <div className="stream-tag-filter">
        <h6 className="nav-header">{tag.name}</h6>

        {this.props.tag.predefined ?

          <select ref="select" value={this.props.value}>
            <option></option>
            {this.props.tag.values.map((val) => {
              return (
                <option key={val}>{val}</option>
              );
            })}
          </select> :
          <input type="hidden" ref="select" value={this.props.value}/>
        }

      </div>
    );
  }
});

export default StreamTagFilter;
