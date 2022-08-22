import {Fragment} from 'react';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import Count from 'sentry/components/count';
import DateTime from 'sentry/components/dateTime';
import Link from 'sentry/components/links/link';
import TextOverflow from 'sentry/components/textOverflow';
import Tooltip from 'sentry/components/tooltip';
import Version from 'sentry/components/version';
import {IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {SourceMapsArchive} from 'sentry/types';

type Props = {
  archive: SourceMapsArchive;
  onDelete: (name: string) => void;
  orgId: string;
  projectId: string;
};

const SourceMapsArchiveRow = ({archive, orgId, projectId, onDelete}: Props) => {
  const {name, date, fileCount} = archive;
  const archiveLink = `/settings/${orgId}/projects/${projectId}/source-maps/${encodeURIComponent(
    name
  )}`;
  return (
    <Fragment>
      <Column>
        <TextOverflow>
          <Link to={archiveLink}>
            <Version version={name} anchor={false} tooltipRawVersion truncate />
          </Link>
        </TextOverflow>
      </Column>
      <ArtifactsColumn>
        <Count value={fileCount} />
      </ArtifactsColumn>
      <Column>{t('release')}</Column>
      <Column>
        <DateTime date={date} />
      </Column>
      <ActionsColumn>
        <ButtonBar gap={0.5}>
          <Access access={['project:releases']}>
            {({hasAccess}) => (
              <Tooltip
                disabled={hasAccess}
                title={t('You do not have permission to delete artifacts.')}
              >
                <Confirm
                  onConfirm={() => onDelete(name)}
                  message={t(
                    'Are you sure you want to remove all artifacts in this archive?'
                  )}
                  disabled={!hasAccess}
                >
                  <Button
                    size="sm"
                    icon={<IconDelete size="sm" />}
                    title={t('Remove All Artifacts')}
                    aria-label={t('Remove All Artifacts')}
                    disabled={!hasAccess}
                  />
                </Confirm>
              </Tooltip>
            )}
          </Access>
        </ButtonBar>
      </ActionsColumn>
    </Fragment>
  );
};

const Column = styled('div')`
  display: flex;
  align-items: center;
  overflow: hidden;
`;

const ArtifactsColumn = styled(Column)`
  padding-right: ${space(4)};
  text-align: right;
  justify-content: flex-end;
`;

const ActionsColumn = styled(Column)`
  justify-content: flex-end;
`;

export default SourceMapsArchiveRow;
