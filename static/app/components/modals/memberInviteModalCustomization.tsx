import HookOrDefault from 'sentry/components/hookOrDefault';

export const InviteModalHook = HookOrDefault({
  hookName: 'member-invite-modal:customization',
  defaultComponent: ({onSendInvites, children}) =>
    children({sendInvites: onSendInvites, canSend: true, isOverMemberLimit: false}),
});

export type InviteModalRenderFunc = React.ComponentProps<
  typeof InviteModalHook
>['children'];
