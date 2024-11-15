import type {Member} from 'sentry/types/organization';

// check to see if a member has been disabled because of the member limit
export default function isMemberDisabledFromLimit(member?: Member | null) {
  return member?.flags['member-limit:restricted'] ?? false;
}
