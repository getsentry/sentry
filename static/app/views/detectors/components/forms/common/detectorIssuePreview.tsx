import {useTheme} from '@emotion/react';

import {Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import ErrorLevel from 'sentry/components/events/errorLevel';
import ShortId from 'sentry/components/group/inboxBadges/shortId';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import type {AvatarProject} from 'sentry/types/project';

interface DetectorIssuePreviewProps {
  issueTitle: string;
  subtitle: string;
  project?: AvatarProject;
}

export function DetectorIssuePreview({
  issueTitle,
  project,
  subtitle,
}: DetectorIssuePreviewProps) {
  const theme = useTheme();
  const projectSlug = project?.slug ?? 'project';
  const shortId = `${projectSlug.toUpperCase()}-D3M0`;
  return (
    <Container>
      <Section
        title={t('Preview')}
        description={t(
          'Given your configurations, this is a sample of the kind of issue you can expect this Monitor to produce.'
        )}
      >
        <Grid
          radius="lg"
          columns="1fr repeat(5, auto)"
          border="primary"
          justify="center"
          align="center"
        >
          <Flex
            style={{borderTopLeftRadius: theme.radius.lg}}
            borderBottom="primary"
            padding="md"
            background="secondary"
          >
            <Flex marginLeft="2xl">
              <Text bold>{t('Issue')}</Text>
            </Flex>
          </Flex>
          <Flex borderBottom="primary" padding="md" background="secondary">
            <Text bold>{t('Last Seen')}</Text>
          </Flex>
          <Flex borderBottom="primary" padding="md" background="secondary">
            <Text bold>{t('Age')}</Text>
          </Flex>
          <Flex borderBottom="primary" padding="md" background="secondary">
            <Text bold>{t('Events')}</Text>
          </Flex>
          <Flex borderBottom="primary" padding="md" background="secondary">
            <Text bold>{t('Users')}</Text>
          </Flex>
          <Flex
            style={{borderTopRightRadius: theme.radius.lg}}
            borderBottom="primary"
            padding="md"
            background="secondary"
          >
            <Text bold>{t('Assignee')}</Text>
          </Flex>

          <Flex align="start" gap="md" marginLeft="2xl" padding="md">
            <Flex direction="column" gap="sm">
              <Text bold>{issueTitle}</Text>
              <Flex align="center" gap="xs">
                <ErrorLevel level="error" />
                {subtitle}
              </Flex>
              <Flex align="center" gap="xs">
                {project && <ProjectBadge project={project} avatarSize={14} hideName />}
                <Text size="sm" variant="muted">
                  <ShortId shortId={shortId} />
                </Text>
              </Flex>
            </Flex>
          </Flex>
          <Text align="center">4hr ago</Text>
          <Text align="center">2min</Text>
          <Text align="center">1</Text>
          <Text align="center">1.2k</Text>
        </Grid>
      </Section>
    </Container>
  );
}
