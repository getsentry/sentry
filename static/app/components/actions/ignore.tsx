import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';

import {openModal} from 'app/actionCreators/modal';
import ActionLink from 'app/components/actions/actionLink';
import ButtonBar from 'app/components/buttonBar';
import CustomIgnoreCountModal from 'app/components/customIgnoreCountModal';
import CustomIgnoreDurationModal from 'app/components/customIgnoreDurationModal';
import DropdownLink from 'app/components/dropdownLink';
import Duration from 'app/components/duration';
import Tooltip from 'app/components/tooltip';
import {IconChevron, IconMute, IconNot} from 'app/icons';
import {t, tn} from 'app/locale';
import space from 'app/styles/space';
import {
  ResolutionStatus,
  ResolutionStatusDetails,
  UpdateResolutionStatus,
} from 'app/types';

import ActionButton from './button';
import MenuHeader from './menuHeader';

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

  const actionLinkProps = {
    shouldConfirm,
    title: t('Ignore'),
    message: confirmMessage,
    confirmLabel,
    disabled,
  };

  if (isIgnored) {
    return (
      <Tooltip title={t('Change status to unresolved')}>
        <ActionButton
          priority="primary"
          onClick={() => onUpdate({status: ResolutionStatus.UNRESOLVED})}
          label={t('Unignore')}
          icon={<IconNot size="xs" />}
        />
      </Tooltip>
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
    <ButtonBar merged>
      {!hasInbox && (
        <ActionLink
          {...actionLinkProps}
          type="button"
          title={t('Ignore')}
          onAction={() => onUpdate({status: ResolutionStatus.IGNORED})}
          icon={<IconNot size="xs" />}
        >
          {t('Ignore')}
        </ActionLink>
      )}

      <StyledDropdownLink
        customTitle={
          hasInbox ? (
            <IconMute size="xs" color="gray300" />
          ) : (
            <ActionButton
              disabled={disabled}
              icon={<IconChevron direction="down" size="xs" />}
            />
          )
        }
        alwaysRenderMenu
        disabled={disabled}
        anchorRight={hasInbox}
        hasInbox
      >
        <MenuHeader>{t('Ignore')}</MenuHeader>

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
    </ButtonBar>
  );
};

export default IgnoreActions;

const actionLinkCss = p => css`
  color: ${p.theme.subText};
  &:hover {
    border-radius: ${p.theme.borderRadius};
    background: ${p.theme.bodyBackground} !important;
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
  :not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }
  > span {
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
    background: ${p => p.theme.focus};
  }
  ${p =>
    p.hasInbox &&
    `
      flex: 1;
      justify-content: flex-start;
    `};
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
