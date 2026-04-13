import {useContext} from 'react';
import styled from '@emotion/styled';
import type {DistributedOmit} from 'type-fest';

import {Alert, type AlertProps} from '@sentry/scraps/alert';
import {
  Button,
  LinkButton,
  type ButtonProps,
  type LinkButtonProps,
} from '@sentry/scraps/button';
import {Checkbox, type CheckboxProps} from '@sentry/scraps/checkbox';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

import {ControlContext} from './control';

export const MenuComponents = {
  /**
   * A button sized and styled to sit in `menuHeaderTrailingItems`. Inherits the
   * header's font size and renders in secondary text color so it blends with the
   * title rather than competing with it.
   *
   * Use this for lightweight, immediate actions in the header — e.g. "Reset",
   * "Clear", "Invite Member", or "Sync". These actions typically take effect
   * immediately and close the menu. For navigation actions use `LinkButton`
   * instead. For prominent footer actions use `CTAButton`.
   */
  HeaderButton(props: DistributedOmit<ButtonProps, 'priority' | 'size'>) {
    return <StyledHeaderButton size="zero" priority="transparent" {...props} />;
  },

  /**
   * A button sized and styled to sit in `menuHeaderTrailingItems`. Inherits the
   * header's font size and renders in secondary text color so it blends with the
   * title rather than competing with it.
   *
   * Use this for lightweight, immediate actions in the header — e.g. "Reset",
   * "Clear", "Invite Member", or "Sync". These actions typically take effect
   * immediately and close the menu. For navigation actions use `LinkButton`
   * instead. For prominent footer actions use `CTAButton`.
   *
   * `priority` and `size` are locked to keep the header visually consistent.
   */
  ResetButton(props: DistributedOmit<ButtonProps, 'priority' | 'size' | 'children'>) {
    const controlContext = useContext(ControlContext);

    return (
      <StyledHeaderButton
        size="zero"
        priority="transparent"
        {...props}
        onClick={e => {
          props.onClick?.(e);
          controlContext.overlayState?.close();
        }}
      >
        {t('Reset')}
      </StyledHeaderButton>
    );
  },

  ClearButton(props: DistributedOmit<ButtonProps, 'priority' | 'size' | 'children'>) {
    const controlContext = useContext(ControlContext);

    return (
      <StyledHeaderButton
        size="zero"
        priority="transparent"
        {...props}
        onClick={e => {
          props.onClick?.(e);
          controlContext.overlayState?.close();
        }}
      >
        {t('Clear')}
      </StyledHeaderButton>
    );
  },

  /**
   * A button sized for `menuFooter` call-to-action slots. Larger and more
   * visually prominent than `HeaderButton`, making it suitable for primary footer
   * actions that don't navigate — e.g. "Invite Member" or "Create".
   *
   * Use this in `menuFooter` for standalone actions that aren't part of a staged
   * selection workflow. For staged selection (deferred apply/cancel) use
   * `ApplyButton` and `CancelButton` instead. For navigation actions use
   * `CTALinkButton`.
   *
   * `priority` and `size` are locked to keep footer actions visually consistent.
   */
  CTAButton(props: DistributedOmit<ButtonProps, 'priority' | 'size'>) {
    return <Button size="xs" priority="default" {...props} />;
  },
  CTALinkButton(props: DistributedOmit<LinkButtonProps, 'priority' | 'size'>) {
    return <LinkButton size="xs" priority="default" {...props} />;
  },

  /**
   * A primary "Apply" button for use in `menuFooter` in staged selection
   * workflows, where changes are held locally and only committed when the user
   * explicitly confirms. Automatically closes the menu after the `onClick`
   * handler runs.
   *
   * Always pair with `CancelButton`. The typical pattern is:
   *
   * ```tsx
   * menuFooter={
   *   stagedSelect.hasStagedChanges ? (
   *     <Flex gap="md" justify="end">
   *       <MenuComponents.CancelButton onClick={() => stagedSelect.removeStagedChanges()} />
   *       <MenuComponents.ApplyButton onClick={() => stagedSelect.commit(stagedSelect.stagedValue)} />
   *     </Flex>
   *   ) : null
   * }
   * ```
   *
   * `priority` (`primary`) and `size` are locked to keep staged selection UIs consistent.
   */
  ApplyButton(props: DistributedOmit<ButtonProps, 'priority' | 'size' | 'children'>) {
    const controlContext = useContext(ControlContext);
    return (
      <Button
        size="xs"
        priority="primary"
        {...props}
        onClick={e => {
          props.onClick?.(e);
          controlContext.overlayState?.close();
        }}
      >
        {t('Apply')}
      </Button>
    );
  },

  /**
   * A "Cancel" button for use in `menuFooter` in staged selection workflows,
   * where changes are held locally and discarded when the user cancels.
   * Automatically closes the menu after the `onClick` handler runs.
   *
   * Always pair with `ApplyButton`. See `ApplyButton` for the full usage pattern.
   *
   * `priority` and `size` are locked to keep staged selection UIs consistent.
   */
  CancelButton(props: DistributedOmit<ButtonProps, 'priority' | 'size' | 'children'>) {
    const controlContext = useContext(ControlContext);
    return (
      <Button
        size="xs"
        priority="transparent"
        {...props}
        onClick={e => {
          props.onClick?.(e);
          controlContext.overlayState?.close();
        }}
      >
        {t('Cancel')}
      </Button>
    );
  },

  /**
   * A condensed alert for use in `menuFooter` to surface contextual warnings or
   * information without leaving the menu — e.g. "You've reached the selection
   * limit" or "Some items are unavailable".
   *
   * Accepts all Alert `variant` values (`warning`, `info`, `error`, `success`).
   * `system` is locked to `false` to prevent the full-bleed layout from
   * breaking the menu's padding, and `showIcon` is locked to `false` to keep
   * the alert compact.
   */
  Alert({children, ...props}: DistributedOmit<AlertProps, 'system' | 'showIcon'>) {
    return (
      <StyledAlert {...props} system={false} showIcon={false}>
        <Text size="sm">{children}</Text>
      </StyledAlert>
    );
  },

  Checkbox(props: DistributedOmit<CheckboxProps, 'size'>) {
    return <Checkbox size="sm" {...props} />;
  },
};

const StyledAlert = styled(Alert)`
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.lg};
  text-wrap: balance;
`;

const StyledHeaderButton = styled(Button)`
  font-size: inherit; /* Inherit font size from MenuHeader */
  font-weight: ${p => p.theme.font.weight.sans.regular};
  color: ${p => p.theme.tokens.content.secondary};
  padding: 0 ${p => p.theme.space.xs};
  margin: -${p => p.theme.space.sm} -${p => p.theme.space.xs};
`;
