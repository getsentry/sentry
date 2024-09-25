import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {ReplayDrawer} from 'sentry/components/events/eventReplay/replayDrawer';
import useDrawer, {type DrawerOptions} from 'sentry/components/globalDrawer';
import {IconPlay} from 'sentry/icons';
import {tn} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import useReplayCountForIssues from 'sentry/utils/replayCount/useReplayCountForIssues';
import {Divider} from 'sentry/views/issueDetails/divider';

export function ReplayBadge({group, project}: {group: Group; project: Project}) {
  const {openDrawer} = useDrawer();
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const drawerOptions: DrawerOptions = {
    ariaLabel: 'replay drawer',
    shouldCloseOnInteractOutside: el => {
      if (openButtonRef.current?.contains(el)) {
        return false;
      }
      return true;
    },
  };
  const issueTypeConfig = getConfigForIssueType(group, project);
  const {getReplayCountForIssue} = useReplayCountForIssues({
    statsPeriod: '90d',
  });
  const replaysCount = getReplayCountForIssue(group.id, group.issueCategory) ?? 0;

  if (!issueTypeConfig.replays.enabled || replaysCount <= 0) {
    return null;
  }

  return (
    <Fragment>
      <Divider />
      <ReplayButton
        ref={openButtonRef}
        type="button"
        priority="link"
        size="zero"
        icon={<IconPlay size="xs" />}
        onClick={() => {
          openDrawer(
            () => <ReplayDrawer group={group} project={project} />,
            drawerOptions
          );
        }}
      >
        {tn('%s Replay', '%s Replays', replaysCount)}
      </ReplayButton>
    </Fragment>
  );
}

const ReplayButton = styled(Button)`
  color: ${p => p.theme.gray300};
  text-decoration: underline;
  text-decoration-style: dotted;
`;
