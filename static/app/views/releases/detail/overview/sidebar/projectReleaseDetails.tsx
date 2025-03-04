import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Button} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import Count from 'sentry/components/count';
import {DateTime} from 'sentry/components/dateTime';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import * as SidebarSection from 'sentry/components/sidebarSection';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import Version from 'sentry/components/version';
import {IconInfo} from 'sentry/icons/iconInfo';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ReleaseMeta, ReleaseWithHealth} from 'sentry/types/release';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import useFinalizeRelease from 'sentry/views/releases/components/useFinalizeRelease';
import {isVersionInfoSemver} from 'sentry/views/releases/utils';

type Props = {
  projectSlug: string;
  release: ReleaseWithHealth;
  releaseMeta: ReleaseMeta;
};

function ProjectReleaseDetails({release, releaseMeta, projectSlug}: Props) {
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
        <KeyValueTable>
          <KeyValueTableRow
            keyName={t('Created')}
            value={<DateTime date={dateCreated} seconds={false} />}
          />
          <KeyValueTableRow
            keyName={
              <Flex gap={space(0.75)} align="center">
                {t('Finalized')}
                <Tooltip
                  skipWrapper
                  title={tct(
                    'By default a release is created "unreleased".[br]Finalizing a release means that we populate a second timestamp on the release record, which is prioritized over [code:date_created] when sorting releases. [docs:Read More].',
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
            }
            value={
              dateReleased ? (
                <DateTime date={dateReleased} seconds={false} />
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
                  <Button
                    size="xs"
                    style={{marginRight: '-8px'}}
                    onClick={() => {
                      finalizeRelease.mutate([release], {
                        onSettled() {
                          window.location.reload();
                        },
                      });
                    }}
                  >
                    {t('Finalize')}
                  </Button>
                </Tooltip>
              )
            }
          />
          <KeyValueTableRow
            keyName={t('Version')}
            value={<Version version={version} anchor={false} />}
          />
          <KeyValueTableRow
            keyName={t('Semver')}
            value={isVersionInfoSemver(versionInfo.version) ? t('Yes') : t('No')}
          />
          <KeyValueTableRow
            keyName={t('Package')}
            value={
              <StyledTextOverflow ellipsisDirection="left">
                {versionInfo.package ?? '\u2014'}
              </StyledTextOverflow>
            }
          />
          <KeyValueTableRow
            keyName={t('First Event')}
            value={firstEvent ? <TimeSince date={firstEvent} /> : '\u2014'}
          />
          <KeyValueTableRow
            keyName={t('Last Event')}
            value={lastEvent ? <TimeSince date={lastEvent} /> : '\u2014'}
          />
          <KeyValueTableRow
            keyName={t('Source Maps')}
            value={
              <Link
                to={
                  isArtifactBundle
                    ? `/settings/${orgSlug}/projects/${projectSlug}/source-maps/?query=${encodeURIComponent(
                        version
                      )}`
                    : `/settings/${orgSlug}/projects/${projectSlug}/source-maps/${encodeURIComponent(
                        version
                      )}/`
                }
              >
                <Count value={releaseFileCount} />{' '}
                {tn('artifact', 'artifacts', releaseFileCount)}
              </Link>
            }
          />
        </KeyValueTable>
      </SidebarSection.Content>
    </SidebarSection.Wrap>
  );
}

const StyledTextOverflow = styled(TextOverflow)`
  line-height: inherit;
  text-align: right;
`;

export default ProjectReleaseDetails;
