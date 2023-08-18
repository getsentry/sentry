import styled from '@emotion/styled';

import Count from 'sentry/components/count';
import DateTime from 'sentry/components/dateTime';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import Link from 'sentry/components/links/link';
import * as SidebarSection from 'sentry/components/sidebarSection';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import Version from 'sentry/components/version';
import {t, tn} from 'sentry/locale';
import type {ReleaseMeta, ReleaseWithHealth} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import {isVersionInfoSemver} from 'sentry/views/releases/utils';

type Props = {
  projectSlug: string;
  release: ReleaseWithHealth;
  releaseMeta: ReleaseMeta;
};

function ProjectReleaseDetails({release, releaseMeta, projectSlug}: Props) {
  const organization = useOrganization();
  const orgSlug = organization.slug;
  const {version, versionInfo, dateCreated, firstEvent, lastEvent} = release;
  const {releaseFileCount, isArtifactBundle} = releaseMeta;

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
                    ? `/settings/${orgSlug}/projects/${projectSlug}/source-maps/artifact-bundles/?query=${encodeURIComponent(
                        version
                      )}`
                    : `/settings/${orgSlug}/projects/${projectSlug}/source-maps/release-bundles/${encodeURIComponent(
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
