import React from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {openModal} from 'app/actionCreators/modal';
import ActionLink from 'app/components/actions/actionLink';
import CustomIgnoreCountModal from 'app/components/customIgnoreCountModal';
import CustomIgnoreDurationModal from 'app/components/customIgnoreDurationModal';
import DropdownLink from 'app/components/dropdownLink';
import Duration from 'app/components/duration';
import MenuItem from 'app/components/menuItem';
import Tooltip from 'app/components/tooltip';
import {IconMute, IconNot} from 'app/icons';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import {
  ResolutionStatus,
  ResolutionStatusDetails,
  UpdateResolutionStatus,
} from 'app/types';

const IGNORE_DURATIONS = [30, 120, 360, 60 * 24, 60 * 24 * 7];
const IGNORE_COUNTS = [1, 10, 100, 1000, 10000, 100000];
const IGNORE_WINDOWS: [number, string][] = [
  [60, t('per hour')],
  [24 * 60, t('per day')],
  [24 * 7 * 60, t('per week')],
];

type Props = {
  onUpdate: (params: UpdateResolutionStatus) => void;
  disabled?: boolean;
  shouldConfirm?: boolean;
  confirmMessage?: React.ReactNode;
  confirmLabel?: string;
  isIgnored?: boolean;
  hasInbox?: boolean;
};

const IgnoreActions = ({
  onUpdate,
  disabled,
  shouldConfirm,
  confirmMessage,
  confirmLabel = t('Ignore'),
  isIgnored = false,
  hasInbox = false,
}: Props) => {
  const onIgnore = (statusDetails: ResolutionStatusDetails) => {
    return onUpdate({
      status: ResolutionStatus.IGNORED,
      statusDetails: statusDetails || {},
    });
  };

  const onCustomIgnore = (statusDetails: ResolutionStatusDetails) => {
    onIgnore(statusDetails);
  };

  const linkClassName = classNames('btn btn-default btn-sm', {
    active: isIgnored,
  });

  const submenuClassName = classNames('dropdown-submenu', {
    flex: hasInbox,
    'expand-left': hasInbox,
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
            onClick={() => onUpdate({status: ResolutionStatus.UNRESOLVED})}
          >
            <SoloIconNot size="xs" />
          </a>
        </Tooltip>
      </div>
    );
  }

  const openCustomIgnoreDuration = () =>
    openModal(deps => (
      <CustomIgnoreDurationModal
        {...deps}
        onSelected={details => onCustomIgnore(details)}
      />
    ));

  const openCustomIngoreCount = () =>
    openModal(deps => (
      <CustomIgnoreCountModal
        {...deps}
        onSelected={details => onCustomIgnore(details)}
        label={t('Ignore this issue until it occurs again\u2026')}
        countLabel={t('Number of times')}
        countName="ignoreCount"
        windowName="ignoreWindow"
        windowChoices={IGNORE_WINDOWS}
      />
    ));

  const openCustomIgnoreUserCount = () =>
    openModal(deps => (
      <CustomIgnoreCountModal
        {...deps}
        onSelected={details => onCustomIgnore(details)}
        label={t('Ignore this issue until it affects an additional\u2026')}
        countLabel={t('Number of users')}
        countName="ignoreUserCount"
        windowName="ignoreUserWindow"
        windowChoices={IGNORE_WINDOWS}
      />
    ));

  return (
    <div style={{display: 'inline-block'}}>
      <div className="btn-group">
        {!hasInbox && (
          <StyledActionLink
            {...actionLinkProps}
            title={t('Ignore')}
            className={linkClassName}
            onAction={() => onUpdate({status: ResolutionStatus.IGNORED})}
          >
            <StyledIconNot size="xs" />
            {t('Ignore')}
          </StyledActionLink>
        )}

        <StyledDropdownLink
          caret={!hasInbox}
          className={linkClassName}
          customTitle={hasInbox ? <IconMute size="xs" color="gray300" /> : undefined}
          title=""
          alwaysRenderMenu
          disabled={disabled}
          anchorRight={hasInbox}
          hasInbox
        >
          <MenuItem header>Ignore</MenuItem>
          <li className={submenuClassName}>
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
                    onAction={() => onIgnore({ignoreDuration: duration})}
                  >
                    <Duration seconds={duration * 60} />
                  </ActionLink>
                </MenuItem>
              ))}
              <MenuItem divider />
              <MenuItem noAnchor>
                <a onClick={openCustomIgnoreDuration}>{t('Custom')}</a>
              </MenuItem>
            </DropdownLink>
          </li>
          <li className={submenuClassName}>
            <DropdownLink
              title={t('Until this occurs again\u2026')}
              caret={false}
              isNestedDropdown
              alwaysRenderMenu
            >
              {IGNORE_COUNTS.map(count => (
                <li className={submenuClassName} key={count}>
                  <DropdownLink
                    title={
                      count === 1
                        ? t('one time\u2026') // This is intentional as unbalanced string formatters are problematic
                        : tn('%s time\u2026', '%s times\u2026', count)
                    }
                    caret={false}
                    isNestedDropdown
                    alwaysRenderMenu
                  >
                    <MenuItem noAnchor>
                      <ActionLink
                        {...actionLinkProps}
                        onAction={() => onIgnore({ignoreCount: count})}
                      >
                        {t('from now')}
                      </ActionLink>
                    </MenuItem>
                    {IGNORE_WINDOWS.map(([hours, label]) => (
                      <MenuItem noAnchor key={hours}>
                        <ActionLink
                          {...actionLinkProps}
                          onAction={() =>
                            onIgnore({
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
                <a onClick={openCustomIngoreCount}>{t('Custom')}</a>
              </MenuItem>
            </DropdownLink>
          </li>
          <li className={submenuClassName}>
            <DropdownLink
              title={t('Until this affects an additional\u2026')}
              caret={false}
              isNestedDropdown
              alwaysRenderMenu
            >
              {IGNORE_COUNTS.map(count => (
                <li className={submenuClassName} key={count}>
                  <DropdownLink
                    title={tn('one user\u2026', '%s users\u2026', count)}
                    caret={false}
                    isNestedDropdown
                    alwaysRenderMenu
                  >
                    <MenuItem noAnchor>
                      <ActionLink
                        {...actionLinkProps}
                        onAction={() => onIgnore({ignoreUserCount: count})}
                      >
                        {t('from now')}
                      </ActionLink>
                    </MenuItem>
                    {IGNORE_WINDOWS.map(([hours, label]) => (
                      <MenuItem noAnchor key={hours}>
                        <ActionLink
                          {...actionLinkProps}
                          onAction={() =>
                            onIgnore({
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
                <a onClick={openCustomIgnoreUserCount}>{t('Custom')}</a>
              </MenuItem>
            </DropdownLink>
          </li>
        </StyledDropdownLink>
      </div>
    </div>
  );
};

export default IgnoreActions;

const StyledIconNot = styled(IconNot)`
  margin-right: ${space(0.5)};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

// The icon with no text label needs positioning tweaks
// inside the bootstrap button. Hopefully this can be removed
// bootstrap buttons are converted.
const SoloIconNot = styled(IconNot)`
  position: relative;
  top: 1px;
`;

const StyledActionLink = styled(ActionLink)`
  display: flex;
  align-items: center;
  transition: none;
`;

// The icon with no text label needs the height reduced for row actions
const StyledDropdownLink = styled(DropdownLink)<{hasInbox: boolean}>`
  ${p => (p.hasInbox ? 'line-height: 0' : '')};
  transition: none;
`;
