import {DrawerBody, DrawerHeader} from '@sentry/scraps/drawer';

import {IssuePreview} from 'sentry/views/issueDetails/issuePreview/issuePreview';

interface IssuePreviewDrawerProps {
  groupId: string;
}

export function IssuePreviewDrawer({groupId}: IssuePreviewDrawerProps) {
  return (
    <IssuePreview
      groupId={groupId}
      renderHeader={children => <DrawerHeader>{children}</DrawerHeader>}
      renderBody={children => <DrawerBody>{children}</DrawerBody>}
    />
  );
}
