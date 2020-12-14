import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {openModal} from 'app/actionCreators/modal';
import ActionLink from 'app/components/actions/actionLink';
import Button from 'app/components/button';
import CustomIgnoreCountModal from 'app/components/customIgnoreCountModal';
import CustomIgnoreDurationModal from 'app/components/customIgnoreDurationModal';
import DropdownLink from 'app/components/dropdownLink';
import Duration from 'app/components/duration';
import MenuItem from 'app/components/menuItem';
import Tooltip from 'app/components/tooltip';
import {IconChevron, IconMute, IconNot} from 'app/icons';
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

  const actionLinkProps = {
    shouldConfirm,
    title: t('Ignore'),
    message: confirmMessage,
    confirmLabel,
    disabled,
  };

  if (isIgnored) {
    return (
      <IgnoredButtonActionWrapper>
        <Tooltip title={t('Change status to unresolved')}>
          <StyledIgnoreButton
            data-test-id="button-unresolve"
            onClick={() => onUpdate({status: ResolutionStatus.UNRESOLVED})}
            icon={<IconNot size="xs" />}
          />
        </Tooltip>
      </IgnoredButtonActionWrapper>
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
    <IgnoreWrapper>
      <IgnoredButtonActionWrapper>
        {!hasInbox && (
          <StyledIgnoreActionLink
            {...actionLinkProps}
            title={t('Ignore')}
            className={linkClassName}
            onAction={() => onUpdate({status: ResolutionStatus.IGNORED})}
          >
            <StyledIconNot size="xs" />
            {t('Ignore')}
          </StyledIgnoreActionLink>
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
          <StyledMenuItem header>Ignore</StyledMenuItem>
          <DropdownMenuItem hasInbox={hasInbox}>
            <DropdownLink
              title={
                <ActionSubMenu>
                  {t('For\u2026')}
                  <SubMenuChevron>
                    <IconChevron direction="right" size="xs" />
                  </SubMenuChevron>
                </ActionSubMenu>
              }
              caret={false}
              isNestedDropdown
              alwaysRenderMenu
            >
              {IGNORE_DURATIONS.map(duration => (
                <DropdownMenuItem hasInbox={hasInbox} key={duration}>
                  <StyledForActionLink
                    {...actionLinkProps}
                    onAction={() => onIgnore({ignoreDuration: duration})}
                  >
                    <ActionSubMenu>
                      <Duration seconds={duration * 60} />
                    </ActionSubMenu>
                  </StyledForActionLink>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem hasInbox={hasInbox}>
                <ActionSubMenu>
                  <a onClick={openCustomIgnoreDuration}>{t('Custom')}</a>
                </ActionSubMenu>
              </DropdownMenuItem>
            </DropdownLink>
          </DropdownMenuItem>
          <DropdownMenuItem hasInbox={hasInbox}>
            <DropdownLink
              title={
                <ActionSubMenu>
                  {t('Until this occurs again\u2026')}
                  <SubMenuChevron>
                    <IconChevron direction="right" size="xs" />
                  </SubMenuChevron>
                </ActionSubMenu>
              }
              caret={false}
              isNestedDropdown
              alwaysRenderMenu
            >
              {IGNORE_COUNTS.map(count => (
                <DropdownMenuItem hasInbox={hasInbox} key={count}>
                  <DropdownLink
                    title={
                      <ActionSubMenu>
                        {count === 1
                          ? t('one time\u2026') // This is intentional as unbalanced string formatters are problematic
                          : tn('%s time\u2026', '%s times\u2026', count)}
                        <SubMenuChevron>
                          <IconChevron direction="right" size="xs" />
                        </SubMenuChevron>
                      </ActionSubMenu>
                    }
                    caret={false}
                    isNestedDropdown
                    alwaysRenderMenu
                  >
                    <DropdownMenuItem hasInbox={hasInbox}>
                      <StyledActionLink
                        {...actionLinkProps}
                        onAction={() => onIgnore({ignoreCount: count})}
                      >
                        {t('from now')}
                      </StyledActionLink>
                    </DropdownMenuItem>
                    {IGNORE_WINDOWS.map(([hours, label]) => (
                      <DropdownMenuItem hasInbox={hasInbox} key={hours}>
                        <StyledActionLink
                          {...actionLinkProps}
                          onAction={() =>
                            onIgnore({
                              ignoreCount: count,
                              ignoreWindow: hours,
                            })
                          }
                        >
                          {label}
                        </StyledActionLink>
                      </DropdownMenuItem>
                    ))}
                  </DropdownLink>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem hasInbox={hasInbox}>
                <ActionSubMenu>
                  <a onClick={openCustomIngoreCount}>{t('Custom')}</a>
                </ActionSubMenu>
              </DropdownMenuItem>
            </DropdownLink>
          </DropdownMenuItem>
          <DropdownMenuItem hasInbox={hasInbox}>
            <DropdownLink
              title={
                <ActionSubMenu>
                  {t('Until this affects an additional\u2026')}
                  <SubMenuChevron>
                    <IconChevron direction="right" size="xs" />
                  </SubMenuChevron>
                </ActionSubMenu>
              }
              caret={false}
              isNestedDropdown
              alwaysRenderMenu
            >
              {IGNORE_COUNTS.map(count => (
                <DropdownMenuItem hasInbox={hasInbox} key={count}>
                  <DropdownLink
                    title={
                      <ActionSubMenu>
                        {tn('one user\u2026', '%s users\u2026', count)}
                        <SubMenuChevron>
                          <IconChevron direction="right" size="xs" />
                        </SubMenuChevron>
                      </ActionSubMenu>
                    }
                    caret={false}
                    isNestedDropdown
                    alwaysRenderMenu
                  >
                    <DropdownMenuItem hasInbox={hasInbox}>
                      <StyledActionLink
                        {...actionLinkProps}
                        onAction={() => onIgnore({ignoreUserCount: count})}
                      >
                        {t('from now')}
                      </StyledActionLink>
                    </DropdownMenuItem>
                    {IGNORE_WINDOWS.map(([hours, label]) => (
                      <DropdownMenuItem hasInbox={hasInbox} key={hours}>
                        <StyledActionLink
                          {...actionLinkProps}
                          onAction={() =>
                            onIgnore({
                              ignoreUserCount: count,
                              ignoreUserWindow: hours,
                            })
                          }
                        >
                          {label}
                        </StyledActionLink>
                      </DropdownMenuItem>
                    ))}
                  </DropdownLink>
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem hasInbox={hasInbox}>
                <ActionSubMenu>
                  <a onClick={openCustomIgnoreUserCount}>{t('Custom')}</a>
                </ActionSubMenu>
              </DropdownMenuItem>
            </DropdownLink>
          </DropdownMenuItem>
        </StyledDropdownLink>
      </IgnoredButtonActionWrapper>
    </IgnoreWrapper>
  );
};

export default IgnoreActions;

// currently needed when the button is disabled on the issue stream (no issues are selected)
// colors can probably be updated to use theme colors based on design
const disabledCss = css`
  color: #ced3d6;
  border-color: #e3e5e6;
  box-shadow: none;
  cursor: default;
  opacity: 0.65;
  pointer-events: none;
`;

const actionLinkCss = p => css`
  color: ${p.theme.subText};
  &:hover {
    border-radius: ${p.theme.borderRadius};
    background: ${p.theme.bodyBackground} !important;
  }
`;

const dropdownTipCss = p => css`
  & ul {
    padding: 0;
    border-radius: ${p.theme.borderRadius};
    top: 44px;
    &:after {
      border-bottom: 8px solid ${p.theme.bodyBackground};
    }
  }
`;

const inboxSubmenuCss = css`
  flex: hasInbox,
  'expand-left': hasInbox,
`;

const IgnoreWrapper = styled('div')`
  display: inline-flex;
  ${dropdownTipCss};
  & span {
    position: relative;
  }
`;

const IgnoredButtonActionWrapper = styled('div')`
  margin-right: 5px;
  display: inline-flex;
  align-self: baseline;
`;

const StyledIgnoreButton = styled(Button)`
  vertical-align: middle;
  color: ${p => p.theme.white};
  background: ${p => p.theme.purple300};
  border: 1px solid #4538a1;
  & span {
    padding: 6px 4.5px;
  }
  &:hover {
    background: ${p => p.theme.purple300};
    color: ${p => p.theme.white};
    border: 1px solid #4538a1;
  }
`;

const StyledIgnoreActionLink = styled(ActionLink)`
  display: inline-flex;
  align-items: baseline;
  float: left;
  color: #493e54;
  background-image: linear-gradient(to bottom, ${p => p.theme.white} 0%, #fcfbfc 100%);
  background-repeat: repeat-x;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.03);
  font-size: ${p => p.theme.fontSizeSmall};
  padding: ${space(0.5)} 9px;
  border: 1px solid ${p => p.theme.border};
  border-radius: 3px 0 0 3px !important;
  border-right: 0;
  font-weight: 600;
  line-height: 1.5;
  user-select: none;
  transition: none;
  ${p => (p.disabled ? disabledCss : null)};
  &:hover {
    background-color: #e6e6e6;
    border-radius: 3px;
    color: ${p => p.theme.button.default.color};
    border-color: #afa3bb;
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.06);
  }
`;

const StyledIconNot = styled(IconNot)`
  margin-right: ${space(0.5)};
  align-self: center;
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

const StyledActionLink = styled(ActionLink)`
  padding: 7px 10px !important;
  ${actionLinkCss};
`;

const StyledForActionLink = styled(ActionLink)`
  padding: ${space(0.5)} 0;
  ${actionLinkCss};
`;

// The icon with no text label needs the height reduced for row actions
const StyledDropdownLink = styled(DropdownLink)<{hasInbox: boolean}>`
  ${p => (p.hasInbox ? 'line-height: 0' : '')};
  transition: none;
  border-top-left-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
`;

const DropdownMenuItem = styled('li')<{hasInbox: boolean}>`
  :not(:first-child) {
    border-top: 1px solid ${p => p.theme.innerBorder};
  }
  > span {
    border-radius: ${p => p.theme.borderRadius};
    display: block;
    > ul {
      border-radius: ${p => p.theme.borderRadius};
      top: 5px;
      left: 100%;
      margin-top: -5px;
      margin-left: -1px;
      &:after,
      &:before {
        display: none !important;
      }
    }
  }
  &:hover > span {
    background: ${p => p.theme.bodyBackground};
    border-radius: ${p => p.theme.borderRadius};
  }
  ${p => (p.hasInbox ? inboxSubmenuCss : null)};
`;

const StyledMenuItem = styled(MenuItem)`
  text-transform: uppercase;
  padding: ${space(1)} 0 ${space(1)} 10px;
  font-weight: 600;
  color: ${p => p.theme.gray400};
  background: ${p => p.theme.bodyBackground};
  border-radius: ${p => p.theme.borderRadius};
`;

const ActionSubMenu = styled('span')`
  display: grid;
  grid-template-columns: 200px 1fr;
  grid-column-start: 1;
  grid-column-end: 4;
  gap: ${space(1)};
  padding: ${space(0.5)} 0;
  color: ${p => p.theme.textColor};
  a {
    color: ${p => p.theme.textColor};
  }
`;

const SubMenuChevron = styled('span')`
  display: grid;
  align-self: center;
  color: ${p => p.theme.gray300};
  transition: 0.1s color linear;

  &:hover,
  &:active {
    color: ${p => p.theme.subText};
  }
`;
