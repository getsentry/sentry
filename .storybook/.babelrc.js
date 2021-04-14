const config = require('../babel.config.js');

// Why do we have to do this?
// See: https://github.com/babel/babel/issues/11622#issuecomment-638609015
config.plugins = [...config.plugins, '@babel/plugin-proposal-private-methods'];

module.exports = config;
