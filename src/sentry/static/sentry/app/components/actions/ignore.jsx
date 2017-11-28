import React from 'react';
import PropTypes from 'prop-types';
import {t} from '../../locale';
import MenuItem from '../menuItem';
import DropdownLink from '../dropdownLink';
import Duration from '../duration';
import CustomIgnoreCountModal from '../customIgnoreCountModal';
import CustomIgnoreDurationModal from '../customIgnoreDurationModal';

export default class IgnoreActions extends React.Component {
  static propTypes = {
    isIgnored: PropTypes.bool,
    onUpdate: PropTypes.func.isRequired,
  };

  static defaultProps = {
    isIgnored: false,
  };

  constructor(props) {
    super(props);
    this.state = {modal: false};
  }
  getIgnoreDurations() {
    return [30, 120, 360, 60 * 24, 60 * 24 * 7];
  }

  getIgnoreCounts() {
    return [100, 1000, 10000, 100000];
  }

  getIgnoreWindows() {
    return [[1, 'per hour'], [24, 'per day'], [24 * 7, 'per week']];
  }

  onCustomIgnore(statusDetails) {
    this.setState({
      modal: false,
    });
    this.onIgnore(statusDetails);
  }

  onIgnore(statusDetails) {
    return this.props.onUpdate({
      status: 'ignored',
      statusDetails: statusDetails || {},
    });
  }

  render() {
    let {isIgnored, onUpdate} = this.props;
    let linkClassName = 'group-ignore btn btn-default btn-sm';
    if (isIgnored) {
      linkClassName += ' active';
      return (
        <div className="btn-group">
          <a
            className={linkClassName + ' tip'}
            title={t('Change status to unresolved')}
            onClick={() => onUpdate({status: 'unresolved'})}
          >
            <span className="icon-ban" />
          </a>
        </div>
      );
    }

    return (
      <div style={{display: 'inline-block'}}>
        <CustomIgnoreDurationModal
          show={this.state.modal === 'duration'}
          onSelected={this.onCustomIgnore}
          onCanceled={() => this.setState({modal: null})}
        />
        <CustomIgnoreCountModal
          show={this.state.modal === 'count'}
          onSelected={this.onCustomIgnore}
          onCanceled={() => this.setState({modal: null})}
          label={t('Ignore this issue until it occurs again .. ')}
          countLabel={t('Number of times')}
          countName="ignoreCount"
          windowName="ignoreWindow"
          windowChoices={this.getIgnoreWindows()}
        />
        <CustomIgnoreCountModal
          show={this.state.modal === 'users'}
          onSelected={this.onCustomIgnore}
          onCanceled={() => this.setState({modal: null})}
          label={t('Ignore this issue until it affects an additional .. ')}
          countLabel={t('Numbers of users')}
          countName="ignoreUserCount"
          windowName="ignoreUserWindow"
          windowChoices={this.getIgnoreWindows()}
        />
        <div className="btn-group">
          <a
            className={linkClassName}
            title={t('Ignore')}
            onClick={() => onUpdate({status: 'ignored'})}
          >
            <span className="icon-ban" style={{marginRight: 5}} />
            {t('Ignore')}
          </a>
          <DropdownLink caret={true} className={linkClassName} title="">
            <MenuItem header={true}>Ignore Until</MenuItem>
            <li className="dropdown-submenu">
              <DropdownLink
                title="This occurs again after .."
                caret={false}
                isNestedDropdown={true}
              >
                {this.getIgnoreDurations().map(duration => {
                  return (
                    <MenuItem noAnchor={true} key={duration}>
                      <a
                        onClick={this.onIgnore.bind(this, {
                          ignoreDuration: duration,
                        })}
                      >
                        <Duration seconds={duration * 60} />
                      </a>
                    </MenuItem>
                  );
                })}
                <MenuItem divider={true} />
                <MenuItem noAnchor={true}>
                  <a onClick={() => this.setState({modal: 'duration'})}>{t('Custom')}</a>
                </MenuItem>
              </DropdownLink>
            </li>
            <li className="dropdown-submenu">
              <DropdownLink
                title="This occurs again .."
                caret={false}
                isNestedDropdown={true}
              >
                {this.getIgnoreCounts().map(count => {
                  return (
                    <li className="dropdown-submenu" key={count}>
                      <DropdownLink
                        title={t('%s times', count.toLocaleString())}
                        caret={false}
                        isNestedDropdown={true}
                      >
                        <MenuItem noAnchor={true}>
                          <a
                            onClick={this.onIgnore.bind(this, {
                              ignoreCount: count,
                            })}
                          >
                            {t('from now')}
                          </a>
                        </MenuItem>
                        {this.getIgnoreWindows().map(([hours, label]) => {
                          return (
                            <MenuItem noAnchor={true} key={hours}>
                              <a
                                onClick={this.onIgnore.bind(this, {
                                  ignoreCount: count,
                                  ignoreWindow: hours,
                                })}
                              >
                                {label}
                              </a>
                            </MenuItem>
                          );
                        })}
                      </DropdownLink>
                    </li>
                  );
                })}
                <MenuItem divider={true} />
                <MenuItem noAnchor={true}>
                  <a onClick={() => this.setState({modal: 'count'})}>{t('Custom')}</a>
                </MenuItem>
              </DropdownLink>
            </li>
            <li className="dropdown-submenu">
              <DropdownLink
                title="This affects an additional .."
                caret={false}
                isNestedDropdown={true}
              >
                {this.getIgnoreCounts().map(count => {
                  return (
                    <li className="dropdown-submenu" key={count}>
                      <DropdownLink
                        title={t('%s users', count.toLocaleString())}
                        caret={false}
                        isNestedDropdown={true}
                      >
                        <MenuItem noAnchor={true}>
                          <a
                            onClick={this.onIgnore.bind(this, {
                              ignoreUserCount: count,
                            })}
                          >
                            {t('from now')}
                          </a>
                        </MenuItem>
                        {this.getIgnoreWindows().map(([hours, label]) => {
                          return (
                            <MenuItem noAnchor={true} key={hours}>
                              <a
                                onClick={this.onIgnore.bind(this, {
                                  ignoreUserCount: count,
                                  ignoreUserWindow: hours,
                                })}
                              >
                                {label}
                              </a>
                            </MenuItem>
                          );
                        })}
                      </DropdownLink>
                    </li>
                  );
                })}
                <MenuItem divider={true} />
                <MenuItem noAnchor={true}>
                  <a onClick={() => this.setState({modal: 'users'})}>{t('Custom')}</a>
                </MenuItem>
              </DropdownLink>
            </li>
          </DropdownLink>
        </div>
      </div>
    );
  }
}
