import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';

export const InviteModalHook = OverrideOrDefault({
  overrideName: 'member-invite-modal:customization',
  defaultComponent: ({onSendInvites, children}) =>
    children({sendInvites: onSendInvites, canSend: true, isOverMemberLimit: false}),
});

export type InviteModalRenderFunc = React.ComponentProps<
  typeof InviteModalHook
>['children'];
