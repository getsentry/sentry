import React from 'react';
import _ from 'underscore';

import GroupEventDataSection from '../eventDataSection';
import PropTypes from '../../../proptypes';
import KeyValueList from './keyValueList';
import {defined} from '../../../utils';


const ContextBlock = React.createClass({
  propTypes: {
    alias: React.PropTypes.string.isRequired,
    title: React.PropTypes.string,
    data: React.PropTypes.object.isRequired,
    knownData: React.PropTypes.object,
  },

  render() {
    let data = [];
    let className = `context-block context-block-${this.props.data.type}`;
    let title = this.props.title || this.props.data.title;
    let alias = null;

    if (!title) {
      title = this.props.alias;
    } else {
      alias = (
        <small>{' ('}{this.props.alias})</small>
      );
    }

    (this.props.knownData || []).forEach(([key, value]) => {
      if (defined(value)) {
        data.push([key, value]);
      }
    });

    let extraData = [];
    for (let key in this.props.data) {
      if (key !== 'type') {
        extraData.push([key, this.props.data[key]]);
      }
    }

    if (extraData.length > 0) {
      data = data.concat(_.sortBy(extraData, (key, value) => key));
    }

    return (
      <div className={className}>
        <h4>{title}{alias}</h4>
        <KeyValueList data={data} isSorted={false} />
      </div>
    );
  }
});


const DefaultContextType = React.createClass({
  propTypes: {
    alias: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
  },

  render() {
    return (
      <ContextBlock data={this.props.data} alias={this.props.alias} />
    );
  }
});

const DeviceContextType = React.createClass({
  propTypes: {
    alias: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let {name, model, model_id, arch, ...data} = this.props.data;
    return (
      <ContextBlock
        data={data}
        knownData={[
          ['Name', name],
          ['Model', model + (model_id ? ` (${model_id})` : '')],
          ['Architecture', arch]
        ]}
        alias={this.props.alias}
        title="Device" />
    );
  }
});

const OsContextType = React.createClass({
  propTypes: {
    alias: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let {name, version, build, kernel_version, ...data} = this.props.data;
    return (
      <ContextBlock
        data={data}
        knownData={[
          ['Name', name],
          ['Version', version + (build ? ` (${build})` : '')],
          ['Kernel Version', kernel_version],
        ]}
        alias={this.props.alias}
        title="Operating System" />
    );
  }
});

const RuntimeContextType = React.createClass({
  propTypes: {
    alias: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
  },

  render() {
    let {name, version, build, ...data} = this.props.data;
    return (
      <ContextBlock
        data={data}
        knownData={[
          ['Name', name],
          ['Version', version + (build ? ` (${build})` : '')],
        ]}
        alias={this.props.alias}
        title="Runtime" />
    );
  }
});

const CONTEXT_TYPES = {
  'default': DefaultContextType,
  'device': DeviceContextType,
  'os': OsContextType,
  'runtime': RuntimeContextType,
};


const ContextsInterface = React.createClass({
  propTypes: {
    group: PropTypes.Group.isRequired,
    event: PropTypes.Event.isRequired,
    type: React.PropTypes.string.isRequired,
    data: React.PropTypes.object.isRequired,
    isShare: React.PropTypes.bool
  },

  contextTypes: {
    organization: PropTypes.Organization,
    project: PropTypes.Project
  },

  renderContextData() {
    let rv = [];
    for (let key in this.props.data) {
      let value = this.props.data[key];
      let Component = CONTEXT_TYPES[value.type] || DefaultContextType;
      rv.push(
        <Component key={key} alias={key} data={value}/>
      );
    }
    return rv;
  },

  render() {
    let group = this.props.group;
    let evt = this.props.event;

    let title = (
      <div>
        <h3>
          <strong>{'Context'}</strong>
        </h3>
      </div>
    );

    return (
      <GroupEventDataSection
          className="context-box"
          group={group}
          event={evt}
          type={this.props.type}
          title={title}
          wrapTitle={false}>
        {this.renderContextData()}
      </GroupEventDataSection>
    );
  }
});

export default ContextsInterface;
