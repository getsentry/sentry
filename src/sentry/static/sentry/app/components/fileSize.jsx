import React from 'react';

const FileSize = React.createClass({
  propTypes: {
    bytes: React.PropTypes.number.isRequired
  },

  units: ['B', 'KB','MB','GB','TB','PB','EB','ZB','YB'],

  formatBytes: function(bytes) {
      let thresh = 1024, u = 0;
      while (bytes >= thresh) {
        bytes /= thresh;
        ++ u;
      }
      return bytes.toFixed(1) + ' ' + this.units[u];
  },

  render: function() {
    return (
      <span>{this.formatBytes(this.props.bytes)}</span>
    );
  }
});

export default FileSize;

