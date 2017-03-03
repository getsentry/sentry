import React from 'react';

let PropTypes = {
  AnyModel: React.PropTypes.shape({
    id: React.PropTypes.string.isRequired
  }),
  Group: React.PropTypes.shape({
    id: React.PropTypes.string.isRequired
  }),
  Event: React.PropTypes.shape({
    id: React.PropTypes.string.isRequired
  }),
  Organization: React.PropTypes.shape({
    id: React.PropTypes.string.isRequired
  }),
  Project: React.PropTypes.shape({
    id: React.PropTypes.string.isRequired
  }),
  TagKey: React.PropTypes.shape({
    key: React.PropTypes.string.isRequired
  }),
  Team: React.PropTypes.shape({
    id: React.PropTypes.string.isRequired
  }),
  User: React.PropTypes.shape({
    id: React.PropTypes.string.isRequired
  })
};

export default PropTypes;

