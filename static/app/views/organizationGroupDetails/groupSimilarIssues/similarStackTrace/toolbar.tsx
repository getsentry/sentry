import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {PanelHeader} from 'app/components/panels';
import ToolbarHeader from 'app/components/toolbarHeader';
import {t} from 'app/locale';
import GroupingStore from 'app/stores/groupingStore';
import space from 'app/styles/space';
import {callIfFunction} from 'app/utils/callIfFunction';

type Props = {
  onMerge: () => void;
  v2: boolean;
};

const initialState = {
  mergeCount: 0,
};

type State = typeof initialState;

class SimilarToolbar extends Component<Props, State> {
  state: State = initialState;

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
      <PanelHeader hasButtons>
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

        <Columns>
          <StyledToolbarHeader>{t('Events')}</StyledToolbarHeader>

          {v2 ? (
            <StyledToolbarHeader>{t('Score')}</StyledToolbarHeader>
          ) : (
            <Fragment>
              <StyledToolbarHeader>{t('Exception')}</StyledToolbarHeader>
              <StyledToolbarHeader>{t('Message')}</StyledToolbarHeader>
            </Fragment>
          )}
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
