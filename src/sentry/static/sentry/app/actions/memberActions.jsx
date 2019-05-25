import Reflux from 'reflux';

const MemberActions = Reflux.createActions([
  'createSuccess',
  'update',
  'updateError',
  'updateSuccess',
  'resendMemberInvite',
  'resendMemberInviteSuccess',
  'resendMemberInviteError',
]);

export default MemberActions;
