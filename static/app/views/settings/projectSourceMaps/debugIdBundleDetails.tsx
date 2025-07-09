import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import {DateTime} from 'sentry/components/dateTime';
import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {t} from 'sentry/locale';
import type {KeyValueListData} from 'sentry/types/group';
import type {DebugIdBundle, DebugIdBundleArtifact} from 'sentry/types/sourceMaps';
import {AssociatedReleases} from 'sentry/views/settings/projectSourceMaps/associatedReleases';

export function DebugIdBundleDetails({
  debugIdBundle,
  projectId,
}: {
  debugIdBundle: DebugIdBundle | DebugIdBundleArtifact;
  projectId: string;
}) {
  const [showAll, setShowAll] = useState(false);
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
          <Button size="xs" redesign onClick={() => setShowAll(value => !value)}>
            {showAll ? t('Show Less') : t('Show All')}
          </Button>
        ),
        value: (
          <AssociatedReleases
            associations={visibleAssociations}
            shouldFormatVersion={false}
            projectId={projectId}
          />
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
    showAll,
    projectId,
  ]);

  return <StyledKeyValueList data={detailsData} shouldSort={false} />;
}

const StyledKeyValueList = styled(KeyValueList)`
  && {
    margin-bottom: 0;
  }
`;
