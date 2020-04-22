import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';

import {ResolutionStatusDetails} from 'app/types';
import {t, tn} from 'app/locale';
import MenuItem from 'app/components/menuItem';
import DropdownLink from 'app/components/dropdownLink';
import Duration from 'app/components/duration';
import CustomIgnoreCountModal from 'app/components/customIgnoreCountModal';
import CustomIgnoreDurationModal from 'app/components/customIgnoreDurationModal';
import ActionLink from 'app/components/actions/actionLink';
import Tooltip from 'app/components/tooltip';

enum ModalStates {
  COUNT,
  DURATION,
  USERS,
}

const IGNORE_DURATIONS = [30, 120, 360, 60 * 24, 60 * 24 * 7];
const IGNORE_COUNTS = [1, 10, 100, 1000, 10000, 100000];
const IGNORE_WINDOWS: [number, string][] = [
  [60, t('per hour')],
  [24 * 60, t('per day')],
  [24 * 7 * 60, t('per week')],
];

const defaultProps = {
  isIgnored: false,
  confirmLabel: t('Ignore'),
};

type UpdateParams = {
  status: string;
  statusDetails?: ResolutionStatusDetails;
};

type Props = {
  onUpdate: (params: UpdateParams) => void;
  disabled?: boolean;
  shouldConfirm?: boolean;
  confirmMessage?: string;
} & typeof defaultProps;

type State = {
  modal: ModalStates | null;
};

export default class IgnoreActions extends React.Component<Props, State> {
  static propTypes = {
    isIgnored: PropTypes.bool,
    onUpdate: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    shouldConfirm: PropTypes.bool,
    confirmMessage: PropTypes.node,
    confirmLabel: PropTypes.string,
  };

  static defaultProps = defaultProps;

  state = {
    modal: null,
  };

  onCustomIgnore(statusDetails: ResolutionStatusDetails) {
    this.setState({
      modal: null,
    });
    this.onIgnore(statusDetails);
  }

  onIgnore(statusDetails: ResolutionStatusDetails) {
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
      title: t('Ignore'),
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
          show={this.state.modal === ModalStates.DURATION}
          onSelected={details => this.onCustomIgnore(details)}
          onCanceled={() => this.setState({modal: null})}
        />
        <CustomIgnoreCountModal
          show={this.state.modal === ModalStates.COUNT}
          onSelected={details => this.onCustomIgnore(details)}
          onCanceled={() => this.setState({modal: null})}
          label={t('Ignore this issue until it occurs again\u2026')}
          countLabel={t('Number of times')}
          countName="ignoreCount"
          windowName="ignoreWindow"
          windowChoices={IGNORE_WINDOWS}
        />
        <CustomIgnoreCountModal
          show={this.state.modal === ModalStates.USERS}
          onSelected={details => this.onCustomIgnore(details)}
          onCanceled={() => this.setState({modal: null})}
          label={t('Ignore this issue until it affects an additional\u2026')}
          countLabel={t('Number of users')}
          countName="ignoreUserCount"
          windowName="ignoreUserWindow"
          windowChoices={IGNORE_WINDOWS}
        />
        <div className="btn-group">
          <ActionLink
            {...actionLinkProps}
            title={t('Ignore')}
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
                title={t('For\u2026')}
                caret={false}
                isNestedDropdown
                alwaysRenderMenu
              >
                {IGNORE_DURATIONS.map(duration => (
                  <MenuItem noAnchor key={duration}>
                    <ActionLink
                      {...actionLinkProps}
                      onAction={() => this.onIgnore({ignoreDuration: duration})}
                    >
                      <Duration seconds={duration * 60} />
                    </ActionLink>
                  </MenuItem>
                ))}
                <MenuItem divider />
                <MenuItem noAnchor>
                  <a onClick={() => this.setState({modal: ModalStates.DURATION})}>
                    {t('Custom')}
                  </a>
                </MenuItem>
              </DropdownLink>
            </li>
            <li className="dropdown-submenu">
              <DropdownLink
                title={t('Until this occurs again\u2026')}
                caret={false}
                isNestedDropdown
                alwaysRenderMenu
              >
                {IGNORE_COUNTS.map(count => (
                  <li className="dropdown-submenu" key={count}>
                    <DropdownLink
                      title={tn('one time\u2026', '%s times\u2026', count)}
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
                      {IGNORE_WINDOWS.map(([hours, label]) => (
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
                      ))}
                    </DropdownLink>
                  </li>
                ))}
                <MenuItem divider />
                <MenuItem noAnchor>
                  <a onClick={() => this.setState({modal: ModalStates.COUNT})}>
                    {t('Custom')}
                  </a>
                </MenuItem>
              </DropdownLink>
            </li>
            <li className="dropdown-submenu">
              <DropdownLink
                title={t('Until this affects an additional\u2026')}
                caret={false}
                isNestedDropdown
                alwaysRenderMenu
              >
                {IGNORE_COUNTS.map(count => (
                  <li className="dropdown-submenu" key={count}>
                    <DropdownLink
                      title={tn('one user\u2026', '%s users\u2026', count)}
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
                      {IGNORE_WINDOWS.map(([hours, label]) => (
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
                      ))}
                    </DropdownLink>
                  </li>
                ))}
                <MenuItem divider />
                <MenuItem noAnchor>
                  <a onClick={() => this.setState({modal: ModalStates.USERS})}>
                    {t('Custom')}
                  </a>
                </MenuItem>
              </DropdownLink>
            </li>
          </DropdownLink>
        </div>
      </div>
    );
  }
}
