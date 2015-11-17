import React from 'react';

const FileSize = React.createClass({
  propTypes: {
    bytes: React.PropTypes.number.isRequired
  },

  units: ['KB','MB','GB','TB','PB','EB','ZB','YB'],

  formatBytes: function(bytes) {
      let thresh = 1024;
      if (bytes < thresh) {
        return bytes + ' B';
      }

      let u = -1;
      do {
        bytes /= thresh;
        ++u;
      } while (bytes >= thresh);
      return bytes.toFixed(1) + ' ' + this.units[u];
  },

  render: function() {
    return (
      <span>{this.formatBytes(this.props.bytes)}</span>
    );
  }
});

export default FileSize;

