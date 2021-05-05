import styled from '@emotion/styled';

import Count from 'app/components/count';
import DateTime from 'app/components/dateTime';
import {KeyValueTable, KeyValueTableRow} from 'app/components/keyValueTable';
import Link from 'app/components/links/link';
import TextOverflow from 'app/components/textOverflow';
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
  const {version, versionInfo, dateCreated, firstEvent, lastEvent} = release;

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

const StyledTextOverflow = styled(TextOverflow)`
  line-height: inherit;
  text-align: right;
`;

export default ProjectReleaseDetails;
