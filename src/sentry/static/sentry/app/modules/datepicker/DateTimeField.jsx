var React = require('react');
var DateTimePicker = require('./DateTimePicker');
var moment = require('moment');

var DateTimeField = React.createClass({
  propTypes: {
    dateTime: function(props, propName, componentName){
      if (!moment.isMoment(props[propName])) {
        return new Error('Not a valid Moment');
      }
    },
    onChange: React.PropTypes.func,
    format: React.PropTypes.string,
    inputFormat: React.PropTypes.string
  },
  getDefaultProps: function() {
    return {
      dateTime: moment(),
      format: 'X',
      inputFormat: "MM/DD/YY H:mm A",
      showToday: true,
      daysOfWeekDisabled: []
    };
  },
  getInitialState: function() {
    return {
      showDatePicker: true,
      showTimePicker: false,
      widgetStyle: {
        display: 'none',
        position: 'absolute',
        left: 'none',
        zIndex: '9999 !important'
      },
      viewDate: moment(this.props.dateTime, this.props.format).startOf("month"),
      selectedDate: moment(this.props.dateTime, this.props.format),
      inputValue: moment(this.props.dateTime, this.props.format).format(this.props.inputFormat)
    };
  },
  componentWillReceiveProps: function(nextProps) {
    return this.setState({
      viewDate: moment(nextProps.dateTime, nextProps.format).startOf("month"),
      selectedDate: moment(nextProps.dateTime, nextProps.format),
      inputValue: moment(nextProps.dateTime, nextProps.format).format(nextProps.inputFormat)
    });
  },
  onChange: function(event) {
    if (moment(event.target.value, this.props.format).isValid()) {
      this.setState({
        selectedDate: moment(event.target.value, this.props.format),
        inputValue: moment(event.target.value, this.props.format).format(this.props.inputFormat)
      });
    } else {
      this.setState({
        inputValue: event.target.value
      });
      console.log("Invalid date ignored: " + event.target.value);
    }
    if (this.props.onChange) {
      return this.props.onChange(this.state.selectedDate.format(this.props.format));
    }
  },
  setSelectedDate: function(e) {
    return this.setState({
      selectedDate: this.state.viewDate.clone().date(parseInt(e.target.innerHTML)).hour(this.state.selectedDate.hours()).minute(this.state.selectedDate.minutes())
    }, function() {
      this.closePicker();
      if (this.props.onChange) {
        this.props.onChange(this.state.selectedDate.format(this.props.format));
      }
      return this.setState({
        inputValue: this.state.selectedDate.format(this.props.inputFormat)
      });
    });
  },
  setSelectedHour: function(e) {
    return this.setState({
      selectedDate: this.state.selectedDate.clone().hour(parseInt(e.target.innerHTML)).minute(this.state.selectedDate.minutes())
    }, function() {
      this.closePicker();
      if (this.props.onChange) {
        this.props.onChange(this.state.selectedDate.format(this.props.format));
      }
      return this.setState({
        inputValue: this.state.selectedDate.format(this.props.inputFormat)
      });
    });
  },
  setSelectedMinute: function(e) {
    return this.setState({
      selectedDate: this.state.selectedDate.clone().hour(this.state.selectedDate.hours()).minute(parseInt(e.target.innerHTML))
    }, function() {
      this.closePicker();
      if (this.props.onChange) {
        this.props.onChange(this.state.selectedDate.format(this.props.format));
      }
      return this.setState({
        inputValue: this.state.selectedDate.format(this.props.inputFormat)
      });
    });
  },
  setViewMonth: function(month) {
    return this.setState({
      viewDate: this.state.viewDate.clone().month(month)
    });
  },
  setViewYear: function(year) {
    return this.setState({
      viewDate: this.state.viewDate.clone().year(year)
    });
  },
  addMinute: function() {
    return this.setState({
      selectedDate: this.state.selectedDate.clone().add(1, "minutes")
    }, function() {
      if (this.props.onChange) {
        return this.props.onChange(this.state.selectedDate.format(this.props.format));
      }
    });
  },
  addHour: function() {
    return this.setState({
      selectedDate: this.state.selectedDate.clone().add(1, "hours")
    }, function() {
      if (this.props.onChange) {
        return this.props.onChange(this.state.selectedDate.format(this.props.format));
      }
    });
  },
  addMonth: function() {
    return this.setState({
      viewDate: this.state.viewDate.add(1, "months")
    });
  },
  addYear: function() {
    return this.setState({
      viewDate: this.state.viewDate.add(1, "years")
    });
  },
  addDecade: function() {
    return this.setState({
      viewDate: this.state.viewDate.add(10, "years")
    });
  },
  subtractMinute: function() {
    return this.setState({
      selectedDate: this.state.selectedDate.clone().subtract(1, "minutes")
    }, function() {
      if (this.props.onChange) {
        return this.props.onChange(this.state.selectedDate.format(this.props.format));
      }
    });
  },
  subtractHour: function() {
    return this.setState({
      selectedDate: this.state.selectedDate.clone().subtract(1, "hours")
    }, function() {
      if (this.props.onChange) {
        return this.props.onChange(this.state.selectedDate.format(this.props.format));
      }
    });
  },
  subtractMonth: function() {
    return this.setState({
      viewDate: this.state.viewDate.subtract(1, "months")
    });
  },
  subtractYear: function() {
    return this.setState({
      viewDate: this.state.viewDate.subtract(1, "years")
    });
  },
  subtractDecade: function() {
    return this.setState({
      viewDate: this.state.viewDate.subtract(10, "years")
    });
  },
  togglePeriod: function() {
    if (this.state.selectedDate.hour() > 12) {
      return this.setState({
        selectedDate: this.state.selectedDate.clone().subtract(12, 'hours')
      });
    } else {
      return this.setState({
        selectedDate: this.state.selectedDate.clone().add(12, 'hours')
      });
    }
  },
  togglePicker: function() {
    return this.setState({
      showDatePicker: !this.state.showDatePicker,
      showTimePicker: !this.state.showTimePicker
    });
  },
  onClick: function() {
    var classes, gBCR, offset, placePosition, scrollTop, styles;
    if (this.state.showPicker) {
      return this.closePicker();
    } else {
      this.setState({
        showPicker: true
      });
      gBCR = this.refs.dtpbutton.getDOMNode().getBoundingClientRect();
      classes = {
        "bootstrap-datetimepicker-widget": true,
        "dropdown-menu": true
      };
      offset = {
        top: gBCR.top + window.pageYOffset - document.documentElement.clientTop,
        left: gBCR.left + window.pageXOffset - document.documentElement.clientLeft
      };
      offset.top = offset.top + this.refs.datetimepicker.getDOMNode().offsetHeight;
      scrollTop = (window.pageYOffset !== undefined) ? window.pageYOffset : (document.documentElement || document.body.parentNode || document.body).scrollTop;
      placePosition = this.props.direction === 'up' ? 'top' : this.props.direction === 'bottom' ? 'bottom' : this.props.direction === 'auto' ? offset.top + this.refs.widget.getDOMNode().offsetHeight > window.offsetHeight + scrollTop && this.refs.widget.offsetHeight + this.refs.datetimepicker.getDOMNode().offsetHeight > offset.top ? 'top' : 'bottom' : void 0;
      if (placePosition === 'top') {
        offset.top = -this.refs.widget.getDOMNode().offsetHeight - this.getDOMNode().clientHeight - 2;
        classes.top = true;
        classes.bottom = false;
      } else {
        offset.top = 40;
        classes.top = false;
        classes.bottom = true;
      }
      styles = {
        display: 'block',
        position: 'absolute',
        top: offset.top,
        left: 0,
      };
      return this.setState({
        widgetStyle: styles,
        widgetClasses: classes
      });
    }
  },
  closePicker: function(e) {
    var style;
    style = this.state.widgetStyle;
    style.display = 'none';
    return this.setState({
      showPicker: false,
      widgetStyle: style
    });
  },
  renderOverlay: function() {
    var styles;
    styles = {
      position: 'fixed',
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: '999'
    };
    if (this.state.showPicker) {
      return (<div style={styles} onClick={this.closePicker} />);
    } else {
      return <div />;
    }
  },
  render: function() {
    return (
          <span>
            {this.renderOverlay()}
            <DateTimePicker ref="widget"
              widgetClasses={this.state.widgetClasses}
              widgetStyle={this.state.widgetStyle}
              showDatePicker={this.state.showDatePicker}
              showTimePicker={this.state.showTimePicker}
              viewDate={this.state.viewDate}
              selectedDate={this.state.selectedDate}
              showToday={this.props.showToday}
              daysOfWeekDisabled={this.props.daysOfWeekDisabled}
              addDecade={this.addDecade}
              addYear={this.addYear}
              addMonth={this.addMonth}
              addHour={this.addHour}
              addMinute={this.addMinute}
              subtractDecade={this.subtractDecade}
              subtractYear={this.subtractYear}
              subtractMonth={this.subtractMonth}
              subtractHour={this.subtractHour}
              subtractMinute={this.subtractMinute}
              setViewYear={this.setViewYear}
              setViewMonth={this.setViewMonth}
              setSelectedDate={this.setSelectedDate}
              setSelectedHour={this.setSelectedHour}
              setSelectedMinute={this.setSelectedMinute}
              togglePicker={this.togglePicker}
              togglePeriod={this.togglePeriod} />
            <span className="input-group date" ref="datetimepicker">
              <input type="text" className="form-control" onChange={this.onChange} value={this.state.selectedDate.format(this.props.inputFormat)} />
              <span className="input-group-addon" onClick={this.onClick} onBlur={this.onBlur} ref="dtpbutton">
                <span className="icon icon-calendar" />
              </span>
            </span>
          </span>
    );
  }
});

module.exports = DateTimeField;
