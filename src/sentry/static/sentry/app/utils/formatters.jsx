export function userDisplayName(user) {
  let displayName = user.name;
  if (user.email !== user.name) {
    displayName += ' (' + user.email + ')';
  }
  return displayName;
}