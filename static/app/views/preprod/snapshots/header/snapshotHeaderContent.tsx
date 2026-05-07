import {Container, Flex} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {IdBadge} from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {IconCode, IconCommit, IconPullRequest, IconStack} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';
import type {SnapshotDetailsApiResponse} from 'sentry/views/preprod/types/snapshotTypes';
import {getBranchUrl, getPrUrl, getShaUrl} from 'sentry/views/preprod/utils/vcsLinkUtils';

interface SnapshotHeaderContentProps {
  data: SnapshotDetailsApiResponse;
}

export function SnapshotHeaderContent({data}: SnapshotHeaderContentProps) {
  const organization = useOrganization();
  const {vcs_info, app_id: appId} = data;
  const shortSha = vcs_info.head_sha?.slice(0, 7);
  const project = ProjectsStore.getById(data.project_id);
  const shaUrl = getShaUrl(vcs_info, vcs_info.head_sha);
  const prUrl = getPrUrl(vcs_info);
  const branchUrl = getBranchUrl(vcs_info, vcs_info.head_ref);

  return (
    <Layout.HeaderContent unified>
      <Layout.Title>
        <TopBar.Slot name="title">
          {t('Snapshots')}
          <Container display={{'2xs': 'none', xs: 'block'}}>
            <PageHeadingQuestionTooltip
              docsUrl="https://docs.sentry.io/product/preprod/snapshots/"
              title={t('Catch visual regressions before they reach users.')}
            />
          </Container>
        </TopBar.Slot>

        <Flex
          align="center"
          gap="md"
          flexShrink={1}
          minWidth={0}
          display={{'2xs': 'none', xs: 'none', sm: 'none', md: 'flex'}}
        >
          {project && (
            <Container display={{'2xs': 'none', lg: 'block'}}>
              <Text as="div" size="sm">
                <IdBadge project={project} avatarSize={16} />
              </Text>
            </Container>
          )}

          {shortSha && shaUrl && (
            <Flex align="center" gap="xs" flexShrink={0}>
              <IconCommit size="xs" />
              <ExternalLink href={shaUrl}>
                <Text size="sm" variant="accent" monospace wrap="nowrap">
                  {shortSha}
                </Text>
              </ExternalLink>
            </Flex>
          )}

          {vcs_info.pr_number && prUrl ? (
            <Flex align="center" gap="xs" flexShrink={0}>
              <IconPullRequest size="xs" />
              <ExternalLink href={prUrl}>
                <Text size="sm" variant="accent" wrap="nowrap">
                  #{vcs_info.pr_number}
                  {vcs_info.head_ref ? ` (${vcs_info.head_ref})` : ''}
                </Text>
              </ExternalLink>
            </Flex>
          ) : vcs_info.head_ref ? (
            <Flex align="center" gap="xs" flexShrink={0}>
              <IconStack size="xs" />
              {branchUrl ? (
                <ExternalLink href={branchUrl}>
                  <Text size="sm" variant="accent" wrap="nowrap">
                    {vcs_info.head_ref}
                  </Text>
                </ExternalLink>
              ) : (
                <Text size="sm" wrap="nowrap">
                  {vcs_info.head_ref}
                </Text>
              )}
            </Flex>
          ) : null}

          {appId && (
            <Flex align="center" gap="xs" minWidth={0}>
              <IconCode size="xs" style={{flexShrink: 0}} />
              <Link
                to={`/organizations/${organization.slug}/explore/releases/?query=${encodeURIComponent(`app_id:${appId}`)}&tab=snapshots`}
              >
                <Text size="sm" variant="accent" monospace ellipsis>
                  {appId}
                </Text>
              </Link>
            </Flex>
          )}
        </Flex>
      </Layout.Title>
    </Layout.HeaderContent>
  );
}
