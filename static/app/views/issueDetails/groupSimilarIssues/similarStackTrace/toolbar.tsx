import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import PanelHeader from 'sentry/components/panels/panelHeader';
import ToolbarHeader from 'sentry/components/toolbarHeader';
import {t} from 'sentry/locale';
import GroupingStore from 'sentry/stores/groupingStore';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';

type Props = {
  onMerge: () => void;
  organization?: Organization;
  parentGroupId?: number;
};

const initialState = {
  mergeCount: 0,
  mergeList: [] as string[],
};

type State = typeof initialState;

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

  handleSimilarityEmbeddings = (value: string) => {
    if (
      this.state.mergeList.length === 0 ||
      !this.props.organization ||
      !this.props.parentGroupId
    ) {
      return;
    }
    for (const groupId of this.state.mergeList) {
      trackAnalytics(
        'issue_details.similar_issues.similarity_embeddings_feedback_recieved',
        {
          organization: this.props.organization,
          groupId: Number(groupId),
          parentGroupId: this.props.parentGroupId,
          value,
        }
      );
    }
    addSuccessMessage('Sent analytic for similarity embeddings grouping');
  };

  render() {
    const {onMerge, organization} = this.props;
    const {mergeCount} = this.state;
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
            <Fragment>
              <Button
                disabled={mergeCount === 0}
                size="xs"
                title={t('Agree with the grouping of %s issues', mergeCount)}
                onClick={() => {
                  this.handleSimilarityEmbeddings('Yes');
                }}
              >
                {t('Agree %s', `(${mergeCount || 0})`)}
              </Button>
              <Button
                disabled={mergeCount === 0}
                size="xs"
                title={t('Disagree with the grouping of %s issues', mergeCount)}
                onClick={() => {
                  this.handleSimilarityEmbeddings('No');
                }}
              >
                {t('Disagree %s', `(${mergeCount || 0})`)}
              </Button>
            </Fragment>
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
  gap: ${space(1)};
`;
