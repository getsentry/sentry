import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import {t, tn} from 'app/locale';
import MenuItem from 'app/components/menuItem';
import DropdownLink from 'app/components/dropdownLink';
import Duration from 'app/components/duration';
import CustomIgnoreCountModal from 'app/components/customIgnoreCountModal';
import CustomIgnoreDurationModal from 'app/components/customIgnoreDurationModal';
import ActionLink from 'app/components/actions/actionLink';
import Tooltip from 'app/components/tooltip';

export default class IgnoreActions extends React.Component {
  static propTypes = {
    isIgnored: PropTypes.bool,
    onUpdate: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    shouldConfirm: PropTypes.bool,
    confirmMessage: PropTypes.node,
    confirmLabel: PropTypes.string,
  };

  static defaultProps = {
    isIgnored: false,
    confirmLabel: 'Ignore',
  };

  constructor(props) {
    super(props);
    this.state = {modal: false};
  }
  getIgnoreDurations() {
    return [30, 120, 360, 60 * 24, 60 * 24 * 7];
  }

  getIgnoreCounts() {
    return [1, 10, 100, 1000, 10000, 100000];
  }

  getIgnoreWindows() {
    return [[60, 'per hour'], [24 * 60, 'per day'], [24 * 7 * 60, 'per week']];
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
    const {
      isIgnored,
      onUpdate,
      disabled,
      shouldConfirm,
      confirmMessage,
      confirmLabel,
    } = this.props;

    const linkClassName = classNames('btn btn-default btn-sm', {
      active: isIgnored,
    });

    const actionLinkProps = {
      shouldConfirm,
      title: 'Ignore',
      message: confirmMessage,
      confirmLabel,
      disabled,
    };

    if (isIgnored) {
      return (
        <div className="btn-group">
          <Tooltip title={t('Change status to unresolved')}>
            <a
              className={linkClassName}
              data-test-id="button-unresolve"
              onClick={() => onUpdate({status: 'unresolved'})}
            >
              <span className="icon-ban" />
            </a>
          </Tooltip>
        </div>
      );
    }

    return (
      <div style={{display: 'inline-block'}}>
        <CustomIgnoreDurationModal
          show={this.state.modal === 'duration'}
          onSelected={details => this.onCustomIgnore(details)}
          onCanceled={() => this.setState({modal: null})}
        />
        <CustomIgnoreCountModal
          show={this.state.modal === 'count'}
          onSelected={details => this.onCustomIgnore(details)}
          onCanceled={() => this.setState({modal: null})}
          label={t('Ignore this issue until it occurs again\u2026')}
          countLabel={t('Number of times')}
          countName="ignoreCount"
          windowName="ignoreWindow"
          windowChoices={this.getIgnoreWindows()}
        />
        <CustomIgnoreCountModal
          show={this.state.modal === 'users'}
          onSelected={details => this.onCustomIgnore(details)}
          onCanceled={() => this.setState({modal: null})}
          label={t('Ignore this issue until it affects an additional\u2026')}
          countLabel={t('Number of users')}
          countName="ignoreUserCount"
          windowName="ignoreUserWindow"
          windowChoices={this.getIgnoreWindows()}
        />
        <div className="btn-group">
          <ActionLink
            {...actionLinkProps}
            title="Ignore"
            className={linkClassName}
            onAction={() => onUpdate({status: 'ignored'})}
          >
            <span className="icon-ban hidden-xs" style={{marginRight: 5}} />
            {t('Ignore')}
          </ActionLink>

          <DropdownLink
            caret
            className={linkClassName}
            title=""
            alwaysRenderMenu
            disabled={disabled}
          >
            <MenuItem header>Ignore</MenuItem>
            <li className="dropdown-submenu">
              <DropdownLink
                title={'For\u2026'}
                caret={false}
                isNestedDropdown
                alwaysRenderMenu
              >
                {this.getIgnoreDurations().map(duration => {
                  return (
                    <MenuItem noAnchor key={duration}>
                      <ActionLink
                        {...actionLinkProps}
                        onAction={() => this.onIgnore({ignoreDuration: duration})}
                      >
                        <Duration seconds={duration * 60} />
                      </ActionLink>
                    </MenuItem>
                  );
                })}
                <MenuItem divider />
                <MenuItem noAnchor>
                  <a onClick={() => this.setState({modal: 'duration'})}>{t('Custom')}</a>
                </MenuItem>
              </DropdownLink>
            </li>
            <li className="dropdown-submenu">
              <DropdownLink
                title={'Until this occurs again\u2026'}
                caret={false}
                isNestedDropdown
                alwaysRenderMenu
              >
                {this.getIgnoreCounts().map(count => {
                  return (
                    <li className="dropdown-submenu" key={count}>
                      <DropdownLink
                        title={tn('one time', '%s times', count)}
                        caret={false}
                        isNestedDropdown
                        alwaysRenderMenu
                      >
                        <MenuItem noAnchor>
                          <ActionLink
                            {...actionLinkProps}
                            onAction={() => this.onIgnore({ignoreCount: count})}
                          >
                            {t('from now')}
                          </ActionLink>
                        </MenuItem>
                        {this.getIgnoreWindows().map(([hours, label]) => {
                          return (
                            <MenuItem noAnchor key={hours}>
                              <ActionLink
                                {...actionLinkProps}
                                onAction={() =>
                                  this.onIgnore({
                                    ignoreCount: count,
                                    ignoreWindow: hours,
                                  })
                                }
                              >
                                {label}
                              </ActionLink>
                            </MenuItem>
                          );
                        })}
                      </DropdownLink>
                    </li>
                  );
                })}
                <MenuItem divider />
                <MenuItem noAnchor>
                  <a onClick={() => this.setState({modal: 'count'})}>{t('Custom')}</a>
                </MenuItem>
              </DropdownLink>
            </li>
            <li className="dropdown-submenu">
              <DropdownLink
                title={'Until this affects an additional\u2026'}
                caret={false}
                isNestedDropdown
                alwaysRenderMenu
              >
                {this.getIgnoreCounts().map(count => {
                  return (
                    <li className="dropdown-submenu" key={count}>
                      <DropdownLink
                        title={tn('one user', '%s users', count)}
                        caret={false}
                        isNestedDropdown
                        alwaysRenderMenu
                      >
                        <MenuItem noAnchor>
                          <ActionLink
                            {...actionLinkProps}
                            onAction={() => this.onIgnore({ignoreUserCount: count})}
                          >
                            {t('from now')}
                          </ActionLink>
                        </MenuItem>
                        {this.getIgnoreWindows().map(([hours, label]) => {
                          return (
                            <MenuItem noAnchor key={hours}>
                              <ActionLink
                                {...actionLinkProps}
                                onAction={() =>
                                  this.onIgnore({
                                    ignoreUserCount: count,
                                    ignoreUserWindow: hours,
                                  })
                                }
                              >
                                {label}
                              </ActionLink>
                            </MenuItem>
                          );
                        })}
                      </DropdownLink>
                    </li>
                  );
                })}
                <MenuItem divider />
                <MenuItem noAnchor>
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
