import React, {Component} from 'react';
import styled from '@emotion/styled';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import PanelHeader from 'sentry/components/panels/panelHeader';
import ToolbarHeader from 'sentry/components/toolbarHeader';
import {t} from 'sentry/locale';
import GroupingStore from 'sentry/stores/groupingStore';
import {space} from 'sentry/styles/space';
import {Group, Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';

type Props = {
  onMerge: () => void;
  organization?: Organization;
  parentGroupId?: number;
};

const initialState = {
  mergeCount: 0,
  mergeList: [],
};

type State = typeof initialState;

const handleSimilarityEmbeddings = (
  organization: Organization | undefined,
  value: string,
  parentGroupId: number | undefined,
  groupList: Group[]
) => {
  if (groupList.length === 0 || !organization || !parentGroupId) {
    return;
  }
  for (const groupId of groupList) {
    trackAnalytics(
      'issue_details.similar_issues.similarity_embeddings_feedback_recieved',
      {
        organization,
        groupId: Number(groupId),
        parentGroupId,
        value,
      }
    );
  }
  addSuccessMessage('Sent analytic for similarity embeddings grouping');
};
class SimilarToolbar extends Component<Props, State> {
  state: State = initialState;

  componentWillUnmount() {
    this.listener?.();
  }

  onGroupChange = ({mergeList}) => {
    if (!mergeList?.length) {
      return;
    }

    if (mergeList.length !== this.state.mergeCount) {
      this.setState({mergeCount: mergeList.length, mergeList});
    }
  };

  listener = GroupingStore.listen(this.onGroupChange, undefined);

  render() {
    const {onMerge, parentGroupId, organization} = this.props;
    const {mergeCount, mergeList} = this.state;
    const hasSimilarityEmbeddingsFeature = organization?.features?.includes(
      'issues-similarity-embeddings'
    );

    return (
      <PanelHeader hasButtons>
        <ButtonPanel>
          <Confirm
            disabled={mergeCount === 0}
            message={t('Are you sure you want to merge these issues?')}
            onConfirm={onMerge}
          >
            <Button size="xs" title={t('Merging %s issues', mergeCount)}>
              {t('Merge %s', `(${mergeCount || 0})`)}
            </Button>
          </Confirm>
          {hasSimilarityEmbeddingsFeature && (
            <React.Fragment>
              <Button
                disabled={mergeCount === 0}
                size="xs"
                title={t('Agree with the grouping of %s issues', mergeCount)}
                onClick={() => {
                  handleSimilarityEmbeddings(
                    organization,
                    'Yes',
                    parentGroupId,
                    mergeList
                  );
                }}
              >
                {t('Agree %s', `(${mergeCount || 0})`)}
              </Button>
              <Button
                disabled={mergeCount === 0}
                size="xs"
                title={t('Disagree with the grouping of %s issues', mergeCount)}
                onClick={() => {
                  handleSimilarityEmbeddings(
                    organization,
                    'No',
                    parentGroupId,
                    mergeList
                  );
                }}
              >
                {t('Disagree %s', `(${mergeCount || 0})`)}
              </Button>
            </React.Fragment>
          )}
        </ButtonPanel>

        <Columns>
          <StyledToolbarHeader>{t('Events')}</StyledToolbarHeader>
          <StyledToolbarHeader>{t('Exception')}</StyledToolbarHeader>
          <StyledToolbarHeader>{t('Message')}</StyledToolbarHeader>
        </Columns>
      </PanelHeader>
    );
  }
}
export default SimilarToolbar;

const Columns = styled('div')`
  display: flex;
  align-items: center;
  flex-shrink: 0;
  min-width: 300px;
  width: 300px;
`;

const StyledToolbarHeader = styled(ToolbarHeader)`
  flex: 1;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding: ${space(0.5)} 0;
`;

const ButtonPanel = styled('div')`
  display: flex;
  align-items: left;
  gap: 10px;
`;
