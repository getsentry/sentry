/*** @jsx React.DOM */
var React = require('react');

var BarChart = React.createClass({
  propTypes: {
    points: React.PropTypes.arrayOf(React.PropTypes.shape({
      x: React.PropTypes.number.isRequired,
      y: React.PropTypes.number.isRequired,
      label: React.PropTypes.string
    })),
    placement: React.PropTypes.string
  },

  getDefaultProps: function(){
    return {
      placement: 'bottom'
    };
  },

  floatFormat: function(number, places) {
      var multi = Math.pow(10, places);
      return parseInt(number * multi, 10) / multi;
  },

  render: function(){
    // TODO: maxval could default to # of hours since first_seen / times_seen
    var points = this.props.points;

    var maxval = 10;
    points.forEach(function(point){
      if (point.y > maxval) {
        maxval = point.y;
      }
    });

    var pointWidth = this.floatFormat(100.0 / points.length, 2) + '%';

    var children = [];
    points.forEach(function(point){
      var pct = this.floatFormat(point.y / maxval * 99, 2) + '%';

      var title;
      if (point.label) {
        title = <span>{point.y} events<br />({point.label})</span>;
      } else {
        title = <span>{point.y} events</span>;
      }

      children.push((
        <a style={{width: pointWidth}}
           key={point.x}
           title={title}>
          <span style={{height: pct}}>{point.y}</span>
        </a>
      ));
        // $('<a style="width:' + pointWidth + ';" rel="tooltip" title="' + title + '"><span style="height:' + pct + '">' + point.y + '</span></a>').tooltip({
        //   placement: options.placement || 'bottom',
        //   html: true,
        //   container: 'body'
        // }).appendTo($el);
    }.bind(this));

    return (
      <figure className={this.props.className}>
        {children}
      </figure>
    );
  }
});

module.exports = BarChart;
