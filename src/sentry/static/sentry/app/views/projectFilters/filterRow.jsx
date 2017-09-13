import PropTypes from 'prop-types';
import React from 'react';

import Switch from '../../components/switch';
import marked from '../../utils/marked';

const FilterSwitch = function(props) {
  return (
    <Switch
      size={props.size}
      isActive={props.data.active}
      toggle={function() {
        props.onToggle(props.data, !props.data.active);
      }}
    />
  );
};

FilterSwitch.propTypes = {
  data: PropTypes.object.isRequired,
  onToggle: PropTypes.func.isRequired,
  size: PropTypes.string.isRequired
};

const FilterRow = React.createClass({
  propTypes: {
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
    onToggle: PropTypes.func.isRequired
  },

  getInitialState() {
    return {
      loading: false,
      error: false
    };
  },

  onToggleSubfilters(active) {
    this.props.onToggle(this.props.data.subFilters, active);
  },

  render() {
    let data = this.props.data;

    return (
      <div style={{borderTop: '1px solid #f2f3f4', padding: '20px 0 0'}}>
        <div className="row">
          <div className="col-md-9">
            <h5 style={{marginBottom: 10}}>{data.name}</h5>
            {data.description &&
              <small
                className="help-block"
                dangerouslySetInnerHTML={{
                  __html: marked(data.description)
                }}
              />}
          </div>
          <div className="col-md-3 align-right" style={{paddingRight: '25px'}}>
            <FilterSwitch {...this.props} size="lg" />
          </div>
        </div>
      </div>
    );
  }
});

export default FilterRow;
