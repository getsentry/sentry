import {IssueSourceLinkAction} from 'sentry/components/stackTrace/issueStackTrace/issueSourceLinkAction';
import {IssueSourceMapsDebuggerAction} from 'sentry/components/stackTrace/issueStackTrace/issueSourceMapsDebuggerAction';

import {NativeFrameActions} from './nativeDefaultActions';

/** Native frame actions on issue details, with source links. */
export function NativeIssueFrameActions({isHovering}: {isHovering: boolean}) {
  return (
    <NativeFrameActions>
      <IssueSourceLinkAction isHovering={isHovering} />
      <IssueSourceMapsDebuggerAction />
    </NativeFrameActions>
  );
}
