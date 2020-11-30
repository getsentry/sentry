import React from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import FlowLayout from 'app/components/flowLayout';
import SpreadLayout from 'app/components/spreadLayout';
import Toolbar from 'app/components/toolbar';
import ToolbarHeader from 'app/components/toolbarHeader';
import {t} from 'app/locale';
import GroupingStore from 'app/stores/groupingStore';
import space from 'app/styles/space';
import {callIfFunction} from 'app/utils/callIfFunction';

type Props = {
  onMerge: () => void;
  v2: boolean;
};

const inititalState = {
  mergeCount: 0,
};

type State = typeof inititalState;

class SimilarToolbar extends React.Component<Props, State> {
  state: State = inititalState;

  componentWillUnmount() {
    callIfFunction(this.listener);
  }

  onGroupChange = ({mergeList}) => {
    if (!mergeList?.length) {
      return;
    }

    if (mergeList.length !== this.state.mergeCount) {
      this.setState({mergeCount: mergeList.length});
    }
  };

  listener = GroupingStore.listen(this.onGroupChange, undefined);

  render() {
    const {onMerge, v2} = this.props;
    const {mergeCount} = this.state;

    return (
      <Toolbar>
        <SpreadLayout responsive>
          <StyledFlowLayout>
            <FlowLayout>
              <Actions>
                <Confirm
                  data-test-id="merge"
                  disabled={mergeCount === 0}
                  message={t('Are you sure you want to merge these issues?')}
                  onConfirm={onMerge}
                >
                  <Button size="small" title={t('Merging %s issues', mergeCount)}>
                    {t('Merge %s', `(${mergeCount || 0})`)}
                  </Button>
                </Confirm>
              </Actions>
            </FlowLayout>
          </StyledFlowLayout>

          <Columns>
            <StyledToolbarHeader className="event-count-header">
              {t('Events')}
            </StyledToolbarHeader>

            {v2 ? (
              <StyledToolbarHeader className="event-similar-header">
                {t('Score')}
              </StyledToolbarHeader>
            ) : (
              <React.Fragment>
                <StyledToolbarHeader className="event-similar-header">
                  {t('Exception')}
                </StyledToolbarHeader>
                <StyledToolbarHeader className="event-similar-header">
                  {t('Message')}
                </StyledToolbarHeader>
              </React.Fragment>
            )}
          </Columns>
        </SpreadLayout>
      </Toolbar>
    );
  }
}
export default SimilarToolbar;

const Actions = styled('div')`
  margin-left: ${space(3)};
  padding: ${space(0.5)} 0;
`;

const StyledFlowLayout = styled(FlowLayout)`
  flex: 1;
`;

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
