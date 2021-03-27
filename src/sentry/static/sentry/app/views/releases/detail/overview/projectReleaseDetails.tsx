import React from 'react';

import Count from 'app/components/count';
import DateTime from 'app/components/dateTime';
import {KeyValueTable, KeyValueTableRow} from 'app/components/keyValueTable';
import Link from 'app/components/links/link';
import TimeSince from 'app/components/timeSince';
import Version from 'app/components/version';
import {t, tn} from 'app/locale';
import {ReleaseMeta, ReleaseWithHealth} from 'app/types';

import {SectionHeading, Wrapper} from './styles';

type Props = {
  release: ReleaseWithHealth;
  releaseMeta: ReleaseMeta;
  orgSlug: string;
  projectSlug: string;
};

const ProjectReleaseDetails = ({release, releaseMeta, orgSlug, projectSlug}: Props) => {
  const {version, dateCreated, firstEvent, lastEvent} = release;

  return (
    <Wrapper>
      <SectionHeading>{t('Project Release Details')}</SectionHeading>
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
          keyName={t('First Event')}
          value={firstEvent ? <TimeSince date={firstEvent} /> : '-'}
        />
        <KeyValueTableRow
          keyName={t('Last Event')}
          value={lastEvent ? <TimeSince date={lastEvent} /> : '-'}
        />
        <KeyValueTableRow
          keyName={t('Source Maps')}
          value={
            <Link
              to={`/settings/${orgSlug}/projects/${projectSlug}/source-maps/${encodeURIComponent(
                version
              )}/`}
            >
              <Count value={releaseMeta.releaseFileCount} />{' '}
              {tn('artifact', 'artifacts', releaseMeta.releaseFileCount)}
            </Link>
          }
        />
      </KeyValueTable>
    </Wrapper>
  );
};

export default ProjectReleaseDetails;
