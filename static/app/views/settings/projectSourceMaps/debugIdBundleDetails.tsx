import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {DateTime} from 'sentry/components/dateTime';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import type {KeyValueListData} from 'sentry/types/group';
import type {DebugIdBundle, DebugIdBundleArtifact} from 'sentry/types/sourceMaps';
import useOrganization from 'sentry/utils/useOrganization';
import {makeReleasesPathname} from 'sentry/views/releases/utils/pathnames';

const formatDist = (dist: string | string[] | null) => {
  if (Array.isArray(dist)) {
    return dist.join(', ');
  }
  if (dist === null) {
    return 'none';
  }
  return dist;
};

export function DebugIdBundleDetails({
  debugIdBundle,
}: {
  debugIdBundle: DebugIdBundle | DebugIdBundleArtifact;
}) {
  const [showAll, setShowAll] = useState(false);
  const organization = useOrganization();
  const detailsData = useMemo<KeyValueListData>(() => {
    const associations = debugIdBundle.associations;
    const visibleAssociations = showAll ? associations : associations.slice(0, 3);
    return [
      {
        key: 'count',
        subject: t('Artifacts'),
        value: debugIdBundle.fileCount,
      },
      {
        key: 'releases',
        subject: t('Associated Releases'),
        actionButton: associations.length > 3 && (
          <Button size="xs" onClick={() => setShowAll(value => !value)}>
            {showAll ? t('Show Less') : t('Show All')}
          </Button>
        ),
        value:
          associations.length > 0 ? (
            <ReleasesWrapper className="val-string-multiline">
              {visibleAssociations.map(association => (
                <Fragment key={association.release}>
                  <Link
                    to={makeReleasesPathname({
                      organization,
                      path: `/${association.release}/`,
                    })}
                  >
                    {association.release}
                  </Link>
                  {` (Dist: ${formatDist(association.dist)})`}
                  <br />
                </Fragment>
              ))}
            </ReleasesWrapper>
          ) : (
            t('No releases associated with this upload.')
          ),
      },
      {
        key: 'date',
        subject: t('Date Uploaded'),
        value: (
          <pre>
            <DateTime timeZone year date={debugIdBundle.date} />
          </pre>
        ),
      },
    ];
  }, [
    debugIdBundle.associations,
    debugIdBundle.date,
    debugIdBundle.fileCount,
    organization,
    showAll,
  ]);

  return <StyledKeyValueList data={detailsData} shouldSort={false} />;
}

const ReleasesWrapper = styled('pre')`
  max-height: 200px;
  overflow-y: auto !important;
`;

const StyledKeyValueList = styled(KeyValueList)`
  && {
    margin-bottom: 0;
  }
`;
