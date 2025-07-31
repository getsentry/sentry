import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import Count from 'sentry/components/count';
import {DateTime} from 'sentry/components/dateTime';
import {Card} from 'sentry/components/keyValueData';
import LoadingError from 'sentry/components/loadingError';
import Placeholder from 'sentry/components/placeholder';
import TimeSince from 'sentry/components/timeSince';
import {t, tn} from 'sentry/locale';
import type {ReleaseMeta} from 'sentry/types/release';
import useOrganization from 'sentry/utils/useOrganization';
import {isVersionInfoSemver} from 'sentry/views/releases/utils';
import {useReleaseDetails} from 'sentry/views/releases/utils/useReleaseDetails';

interface DetailsSectionProps {
  isMetaError: boolean;
  projectSlug: string | undefined;
  release: string;
  releaseMeta?: ReleaseMeta;
}

export function GeneralCard({
  isMetaError,
  projectSlug,
  release,
  releaseMeta,
}: DetailsSectionProps) {
  const {isError: isDetailsError, data: releaseDetails} = useReleaseDetails({
    release,
  });
  const organization = useOrganization();

  if (isDetailsError) {
    return <LoadingError />;
  }

  const generalContentItems = [
    {
      item: {
        key: t('Date Created'),
        subject: t('Date Created'),
        value: releaseDetails ? (
          <DateTime date={releaseDetails.dateCreated} />
        ) : (
          <TinyPlaceholder />
        ),
      },
    },
    {
      item: {
        key: t('Semver'),
        subject: t('Semver'),
        value: releaseDetails ? (
          isVersionInfoSemver(releaseDetails.versionInfo.version) ? (
            t('Yes')
          ) : (
            t('No')
          )
        ) : (
          <TinyPlaceholder />
        ),
      },
    },
    {
      item: {
        key: t('Package'),
        subject: t('Package'),
        value: releaseDetails ? (
          (releaseDetails.versionInfo.package ?? '\u2014')
        ) : (
          <TinyPlaceholder />
        ),
      },
    },
    {
      item: {
        key: t('First Event'),
        subject: t('First Event'),
        value: releaseDetails ? (
          releaseDetails.firstEvent ? (
            <TimeSince date={releaseDetails.firstEvent} />
          ) : (
            '-'
          )
        ) : (
          <TinyPlaceholder />
        ),
      },
    },
    {
      item: {
        key: t('Last Event'),
        subject: t('Last Event'),
        value: releaseDetails ? (
          releaseDetails.lastEvent ? (
            <TimeSince date={releaseDetails.lastEvent} />
          ) : (
            '-'
          )
        ) : (
          <TinyPlaceholder />
        ),
      },
    },
    {
      item: {
        key: t('Source Maps'),
        subject: t('Source Maps'),
        value:
          releaseMeta && releaseDetails && projectSlug ? (
            <Link
              to={
                releaseMeta.isArtifactBundle
                  ? `/settings/${organization.slug}/projects/${projectSlug}/source-maps/?query=${encodeURIComponent(
                      releaseDetails.version
                    )}`
                  : `/settings/${organization.slug}/projects/${projectSlug}/source-maps/${encodeURIComponent(
                      releaseDetails.version
                    )}/`
              }
            >
              <Count value={releaseMeta.releaseFileCount} />{' '}
              {tn('artifact', 'artifacts', releaseMeta.releaseFileCount)}
            </Link>
          ) : isMetaError ? (
            t('Error loading release metadata')
          ) : (
            <TinyPlaceholder />
          ),
      },
    },
  ];

  return <Card title={t('General')} contentItems={generalContentItems} />;
}

const TinyPlaceholder = styled(Placeholder)`
  height: 16px;
`;
