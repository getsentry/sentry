import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Button} from '@sentry/scraps/button';
import {DescriptionList} from '@sentry/scraps/descriptionList';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Count} from 'sentry/components/count';
import {DateTime} from 'sentry/components/dateTime';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {TextOverflow} from 'sentry/components/textOverflow';
import {TimeSince} from 'sentry/components/timeSince';
import {Version} from 'sentry/components/version';
import {IconInfo} from 'sentry/icons/iconInfo';
import {t, tct, tn} from 'sentry/locale';
import type {AvatarProject} from 'sentry/types/project';
import type {ReleaseMeta, ReleaseWithHealth} from 'sentry/types/release';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useFinalizeRelease} from 'sentry/views/explore/releases/components/useFinalizeRelease';
import {isVersionInfoSemver} from 'sentry/views/explore/releases/utils';

type Props = {
  project: AvatarProject;
  release: ReleaseWithHealth;
  releaseMeta: ReleaseMeta;
};

export function ProjectReleaseDetails({release, releaseMeta, project}: Props) {
  const organization = useOrganization();
  const orgSlug = organization.slug;

  const user = useUser();
  const options = user ? user.options : null;

  const {version, versionInfo, dateCreated, dateReleased, firstEvent, lastEvent} =
    release;
  const {releaseFileCount, isArtifactBundle} = releaseMeta;

  const finalizeRelease = useFinalizeRelease();

  return (
    <SidebarSection.Wrap>
      <SidebarSection.Title>{t('Project Release Details')}</SidebarSection.Title>
      <SidebarSection.Content>
        <DescriptionList>
          <DescriptionList.Term>{t('Created')}</DescriptionList.Term>
          <DescriptionList.Details>
            <DateTime date={dateCreated} />
          </DescriptionList.Details>
          <DescriptionList.Term>
            <Flex gap="sm" align="center">
              {t('Finalized')}
              <Tooltip
                skipWrapper
                title={tct(
                  'By default a release is created "unreleased".[br]Finalizing a release means that we populate a second timestamp on the release record, which is prioritized over [code:date_created] when sorting releases. [docs:Read more].',
                  {
                    br: <br />,
                    code: <code />,
                    docs: (
                      <ExternalLink href="https://docs.sentry.io/cli/releases/#finalizing-releases" />
                    ),
                  }
                )}
              >
                <IconInfo />
              </Tooltip>
            </Flex>
          </DescriptionList.Term>
          <DescriptionList.Details>
            {dateReleased ? (
              <DateTime date={dateReleased} />
            ) : (
              <Tooltip
                title={t(
                  'Set release date to %s',
                  moment
                    .tz(
                      release.firstEvent ?? release.dateCreated,
                      options?.timezone ?? ''
                    )
                    .format(
                      options?.clock24Hours
                        ? 'MMMM D, YYYY HH:mm z'
                        : 'MMMM D, YYYY h:mm A z'
                    )
                )}
              >
                <FinalizeButton
                  size="zero"
                  onClick={() => {
                    finalizeRelease.mutate([release], {
                      onSettled() {
                        window.location.reload();
                      },
                    });
                  }}
                >
                  {t('Finalize')}
                </FinalizeButton>
              </Tooltip>
            )}
          </DescriptionList.Details>
          <DescriptionList.Term>{t('Version')}</DescriptionList.Term>
          <DescriptionList.Details>
            <StyledTextOverflow ellipsisDirection="left">
              <Version version={version} anchor={false} />
            </StyledTextOverflow>
          </DescriptionList.Details>
          <DescriptionList.Term>
            <Flex gap="sm" align="center">
              {t('Semver')}
              <Tooltip
                skipWrapper
                title={tct(
                  'Semver packages format their versions as [code:package@version] or [code:package@version+build]. [docs:Read more].',
                  {
                    code: <code />,
                    docs: (
                      <ExternalLink href="https://docs.sentry.io/cli/releases/#creating-releases" />
                    ),
                  }
                )}
              >
                <IconInfo />
              </Tooltip>
            </Flex>
          </DescriptionList.Term>
          <DescriptionList.Details>
            {versionInfo && isVersionInfoSemver(versionInfo.version) ? t('Yes') : t('No')}
          </DescriptionList.Details>
          <DescriptionList.Term>{t('Package')}</DescriptionList.Term>
          <DescriptionList.Details>
            <StyledTextOverflow ellipsisDirection="left">
              {versionInfo?.package ?? '\u2014'}
            </StyledTextOverflow>
          </DescriptionList.Details>
          <DescriptionList.Term>{t('First Activity')}</DescriptionList.Term>
          <DescriptionList.Details>
            {firstEvent ? <TimeSince date={firstEvent} /> : '\u2014'}
          </DescriptionList.Details>
          <DescriptionList.Term>{t('Last Activity')}</DescriptionList.Term>
          <DescriptionList.Details>
            {lastEvent ? <TimeSince date={lastEvent} /> : '\u2014'}
          </DescriptionList.Details>
          <DescriptionList.Term>{t('Source Maps')}</DescriptionList.Term>
          <DescriptionList.Details>
            <Link
              to={
                isArtifactBundle
                  ? `/settings/${orgSlug}/projects/${
                      project.slug
                    }/source-maps/?query=${encodeURIComponent(version)}`
                  : `/settings/${orgSlug}/projects/${
                      project.slug
                    }/source-maps/${encodeURIComponent(version)}/`
              }
            >
              <Count value={releaseFileCount} />{' '}
              {tn('artifact', 'artifacts', releaseFileCount)}
            </Link>
          </DescriptionList.Details>
        </DescriptionList>
      </SidebarSection.Content>
    </SidebarSection.Wrap>
  );
}

const StyledTextOverflow = styled(TextOverflow)`
  line-height: inherit;
`;

const FinalizeButton = styled(Button)`
  font-size: ${p => p.theme.font.size.sm};
  padding-inline: ${p => p.theme.space.xs};
`;
