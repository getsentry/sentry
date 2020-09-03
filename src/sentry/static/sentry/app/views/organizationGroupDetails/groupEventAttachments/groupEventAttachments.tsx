import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import pick from 'lodash/pick';
import * as ReactRouter from 'react-router';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {PanelTable, PanelTableHeader} from 'app/components/panels';
import {t} from 'app/locale';
import Pagination from 'app/components/pagination';
import AsyncComponent from 'app/components/asyncComponent';
import {EventAttachment} from 'app/types';
import Checkbox from 'app/components/checkbox';
import {IconDelete} from 'app/icons';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import BulkController from 'app/components/bulkController';

import GroupEventAttachmentsFilter from './groupEventAttachmentsFilter';
import GroupEventAttachmentsRow from './groupEventAttachmentsRow';

type Props = RouteComponentProps<{orgId: string; groupId: string}, {}> & {
  projectSlug: string;
};

type State = {
  eventAttachments: EventAttachment[];
} & AsyncComponent['state'];

class GroupEventAttachments extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      eventAttachments: [],
    };
  }

  getEndpoints(): [string, string, {}][] {
    const {params, location} = this.props;

    return [
      [
        'eventAttachments',
        `/issues/${params.groupId}/attachments/`,
        {
          query: {
            ...pick(location.query, ['cursor', 'environment', 'types']),
            limit: 50,
          },
        },
      ],
    ];
  }

  handleDeleteSuccess = () => {
    this.fetchData();
  };

  handleBatchDelete = (_ids: string[], isEverythingSelected: boolean) => {
    // TODO(matej): call bulk endpoint once it's finished
    if (isEverythingSelected) {
      // console.log('batch delete all ids');
    } else {
      // console.log('batch delete these ids: ', ids);
    }
    this.fetchData();
  };

  getEmptyMessage() {
    if (this.props.location.query.types) {
      return t('Sorry, no event attachments match your search query.');
    }

    return t("There don't seem to be any event attachments yet.");
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {projectSlug, params, location} = this.props;
    const {loading, eventAttachments} = this.state;

    return (
      <React.Fragment>
        <GroupEventAttachmentsFilter location={location} />
        <BulkController
          pageIds={eventAttachments.map(a => a.id)}
          // TODO(matej): receive from API, X-Hits
          allRowsCount={64}
          // TODO(matej): receive from API, X-Max-Hits
          bulkLimit={60}
          columnsCount={5}
        >
          {({
            selectedIds,
            onPageRowsToggle,
            onRowToggle,
            isPageSelected,
            isAllSelected,
            renderBulkNotice,
          }) => (
            <StyledPanelTable
              headers={[
                <StyledCheckbox
                  key="bulk-checkbox"
                  checked={isPageSelected}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onPageRowsToggle(e.target.checked)
                  }
                />,

                selectedIds.length === 0 ? (
                  t('Name')
                ) : (
                  <Confirm
                    confirmText={t('Delete')}
                    message={t('Are you sure you wish to delete selected attachments?')}
                    priority="danger"
                    onConfirm={() => this.handleBatchDelete(selectedIds, isAllSelected)}
                  >
                    <BulkDeleteButton
                      size="xsmall"
                      icon={<IconDelete size="xs" />}
                      title={t('Bulk delete attachments')}
                    >
                      {t('Delete')}
                    </BulkDeleteButton>
                  </Confirm>
                ),
                t('Type'),
                t('Size'),
                t('Actions'),
              ]}
              emptyMessage={this.getEmptyMessage()}
              isEmpty={eventAttachments.length === 0}
              isLoading={loading}
            >
              {renderBulkNotice()}
              {eventAttachments.map(attachment => (
                <GroupEventAttachmentsRow
                  key={attachment.id}
                  attachment={attachment}
                  orgSlug={params.orgId}
                  projectSlug={projectSlug}
                  groupId={params.groupId}
                  onDelete={this.handleDeleteSuccess}
                  isSelected={selectedIds.includes(attachment.id)}
                  onSelectToggle={onRowToggle}
                />
              ))}
            </StyledPanelTable>
          )}
        </BulkController>
        <Pagination pageLinks={this.state.eventAttachmentsPageLinks} />
      </React.Fragment>
    );
  }
}

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns:
    auto minmax(min-content, 4fr) minmax(max-content, 1fr) minmax(max-content, 1fr)
    auto;
  ${PanelTableHeader} {
    display: flex;
    align-items: center;
  }
`;

const StyledCheckbox = styled(Checkbox)`
  margin: 0 !important; /* override less files */
`;

const BulkDeleteButton = styled(Button)`
  margin: -${space(1)} 0;
`;

export default ReactRouter.withRouter(GroupEventAttachments);
