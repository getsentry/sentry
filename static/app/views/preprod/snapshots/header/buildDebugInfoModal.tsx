import {Fragment, useMemo} from 'react';
import {css} from '@emotion/react';
import pick from 'lodash/pick';

import {Heading} from '@sentry/scraps/text';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {StructuredEventData} from 'sentry/components/structuredEventData';
import {t} from 'sentry/locale';
import type {SnapshotDetailsApiResponse} from 'sentry/views/preprod/types/snapshotTypes';

const VISIBLE_FIELDS: Array<keyof SnapshotDetailsApiResponse> = [
  'app_id',
  'base_artifact_id',
  'comparison_state',
  'diff_threshold',
  'head_artifact_id',
  'project_id',
  'vcs_info',
];

type Props = ModalRenderProps & {
  data: SnapshotDetailsApiResponse;
};

function BuildDebugInfoModal({Header, Body, data}: Props) {
  const filteredData = useMemo(() => pick(data, VISIBLE_FIELDS), [data]);

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h3">{t('Build Metadata')}</Heading>
      </Header>
      <Body>
        <StructuredEventData
          data={filteredData}
          maxDefaultDepth={Infinity}
          autoCollapseLimit={Infinity}
          forceDefaultExpand
          showCopyButton
        />
      </Body>
    </Fragment>
  );
}

export function openBuildDebugInfoModal(data: SnapshotDetailsApiResponse) {
  openModal(deps => <BuildDebugInfoModal {...deps} data={data} />, {
    modalCss: css`
      max-width: 800px;
      width: 90vw;
    `,
  });
}
