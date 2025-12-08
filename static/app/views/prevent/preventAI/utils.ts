export function getRepoNameWithoutOrg(fullName: string): string {
  return fullName.includes('/') ? fullName.split('/').pop() || fullName : fullName;
}
