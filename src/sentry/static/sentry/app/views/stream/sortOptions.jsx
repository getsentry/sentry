var PureRenderMixin = require('react/addons').addons.PureRenderMixin;
var React = require("react");

var DropdownLink = require("../../components/dropdownLink");
var MenuItem = require("../../components/menuItem");

var SortOptions = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  mixins: [PureRenderMixin],

  getInitialState() {
    var router = this.context.router;
    var queryParams = router.getCurrentQuery();

    return {
      sortKey: queryParams.sort || 'date'
    };
  },

  getMenuItem(key) {
    var router = this.context.router;
    var queryParams = $.extend({}, router.getCurrentQuery());
    var params = router.getCurrentParams();

    queryParams.sort = key;

    return (
      <MenuItem to="stream" params={params} query={queryParams}
                isActive={this.state.sortKey === key}>
        {this.getSortLabel(key)}
      </MenuItem>
    );
  },

  componentWillReceiveProps(nextProps) {
    var router = this.context.router;
    this.setState({
      sortKey: router.getCurrentQuery().sort || 'date'
    });
  },

  getSortLabel(key) {
    switch (key) {
      case 'new':
        return 'First Seen';
      case 'priority':
        return 'Priority';
      case 'freq':
        return 'Frequency';
      case 'date':
        return 'Last Seen';
    }
  },

  render() {
    var dropdownTitle = (
      <span>
        <span>Sort by:</span>
        &nbsp; {this.getSortLabel(this.state.sortKey)}
      </span>
    );

    return (
      <DropdownLink
          btnGroup={true}
          title={dropdownTitle}>
        {this.getMenuItem('priority')}
        {this.getMenuItem('date')}
        {this.getMenuItem('new')}
        {this.getMenuItem('freq')}
      </DropdownLink>
    );
  }
});

module.exports = SortOptions;
