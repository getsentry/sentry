import {decodeScalar} from 'sentry/utils/queryString';

// TypeScript thinks the values are strings, but they could be undefined.
// See `noUncheckedIndexedAccess`
interface Return {
  feedbackId: string | undefined;
  projectSlug: string | undefined;
}

export default function decodeFeedbackSlug(
  val: string | string[] | null | undefined
): Return {
  const [projectSlug, feedbackId] = decodeScalar(val, '').split(':');
  return {projectSlug, feedbackId};
}
