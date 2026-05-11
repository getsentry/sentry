import {Global, css} from '@emotion/react';

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
import type {SnapshotDetailsApiResponse} from 'sentry/views/preprod/types/snapshotTypes';
import {getBranchUrl, getPrUrl, getShaUrl} from 'sentry/views/preprod/utils/vcsLinkUtils';

const TITLE_MARKER_ATTR = 'data-snapshot-header-title';

const topBarShrinkOverride = css`
  *:has(> [${TITLE_MARKER_ATTR}]) {
    flex: 1;
    min-width: 0;
  }
  *:has(> [${TITLE_MARKER_ATTR}]) + * {
    flex-shrink: 0;
  }
`;

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

  function renderVcsRef() {
    if (vcs_info.pr_number && prUrl) {
      return (
        <Flex align="center" gap="xs" flexShrink={0}>
          <IconPullRequest size="xs" />
          <ExternalLink href={prUrl}>
            <Text size="sm" variant="accent" wrap="nowrap">
              #{vcs_info.pr_number}
              {vcs_info.head_ref ? ` (${vcs_info.head_ref})` : ''}
            </Text>
          </ExternalLink>
        </Flex>
      );
    }

    if (vcs_info.head_ref) {
      const branchLabel = branchUrl ? (
        <ExternalLink href={branchUrl}>
          <Text size="sm" variant="accent" wrap="nowrap">
            {vcs_info.head_ref}
          </Text>
        </ExternalLink>
      ) : (
        <Text size="sm" wrap="nowrap">
          {vcs_info.head_ref}
        </Text>
      );

      return (
        <Flex align="center" gap="xs" flexShrink={0}>
          <IconStack size="xs" />
          {branchLabel}
        </Flex>
      );
    }

    return null;
  }

  return (
    <Layout.HeaderContent unified>
      <Layout.Title>
        <Global styles={topBarShrinkOverride} />
        <Flex
          align="center"
          gap="md"
          minWidth={0}
          overflow="hidden"
          {...{[TITLE_MARKER_ATTR]: ''}}
        >
          {t('Snapshots')}
          <Container display={{'2xs': 'none', xs: 'flex'}}>
            <PageHeadingQuestionTooltip
              docsUrl="https://docs.sentry.io/product/preprod/snapshots/"
              title={t('Catch visual regressions before they reach users.')}
            />
          </Container>

          {project && (
            <Container display={{'2xs': 'none', lg: 'block'}}>
              <Text as="div" size="sm">
                <IdBadge project={project} avatarSize={16} />
              </Text>
            </Container>
          )}

          <Flex
            align="center"
            gap="md"
            flexShrink={1}
            minWidth={0}
            overflow="hidden"
            display={{'2xs': 'none', xs: 'none', sm: 'flex'}}
          >
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

            {renderVcsRef()}

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
        </Flex>
      </Layout.Title>
    </Layout.HeaderContent>
  );
}
