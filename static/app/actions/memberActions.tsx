import {createActions} from 'reflux';

const MemberActions = createActions([
  'createSuccess',
  'update',
  'updateError',
  'updateSuccess',
  'resendMemberInvite',
  'resendMemberInviteSuccess',
  'resendMemberInviteError',
]);

export default MemberActions;
