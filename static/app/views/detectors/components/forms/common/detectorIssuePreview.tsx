import {ActorAvatar} from '@sentry/scraps/avatar';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ShortId} from 'sentry/components/group/inboxBadges/shortId';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {Actor} from 'sentry/types/core';
import type {AvatarProject} from 'sentry/types/project';

interface DetectorIssuePreviewProps {
  issueTitle: string;
  subtitle: string;
  assignee?: Actor;
  project?: AvatarProject;
}

export function DetectorIssuePreview({
  issueTitle,
  project,
  subtitle,
  assignee,
}: DetectorIssuePreviewProps) {
  const projectSlug = project?.slug ?? 'project';
  const shortId = `${projectSlug.toUpperCase()}-D3M0`;

  return (
    <SimpleTable style={{gridTemplateColumns: '1fr auto auto auto auto auto'}}>
      <SimpleTable.Header>
        <SimpleTable.HeaderCell>{t('Issue')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Last Seen')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Age')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Events')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Users')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Assignee')}</SimpleTable.HeaderCell>
      </SimpleTable.Header>
      <SimpleTable.Row>
        <SimpleTable.RowCell>
          <Flex direction="column" gap="xs">
            <Text bold size="lg">
              {issueTitle}
            </Text>
            <Text size="md">{subtitle}</Text>
            <Flex align="center" gap="xs">
              {project && <ProjectBadge project={project} avatarSize={14} hideName />}
              <Text size="sm" variant="muted">
                <ShortId shortId={shortId} />
              </Text>
            </Flex>
          </Flex>
        </SimpleTable.RowCell>
        <SimpleTable.RowCell justify="end">2min ago</SimpleTable.RowCell>
        <SimpleTable.RowCell justify="end">4h</SimpleTable.RowCell>
        <SimpleTable.RowCell justify="end">1.2k</SimpleTable.RowCell>
        <SimpleTable.RowCell justify="end">620</SimpleTable.RowCell>
        <SimpleTable.RowCell justify="center">
          {assignee && <ActorAvatar actor={assignee} size={20} />}
        </SimpleTable.RowCell>
      </SimpleTable.Row>
    </SimpleTable>
  );
}
