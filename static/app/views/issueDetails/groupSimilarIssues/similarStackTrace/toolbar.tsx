import {Component} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import PanelHeader from 'sentry/components/panels/panelHeader';
import ToolbarHeader from 'sentry/components/toolbarHeader';
import {t} from 'sentry/locale';
import GroupingStore from 'sentry/stores/groupingStore';
import {space} from 'sentry/styles/space';

type Props = {
  onMerge: () => void;
};

const initialState = {
  mergeCount: 0,
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
      this.setState({mergeCount: mergeList.length});
    }
  };

  listener = GroupingStore.listen(this.onGroupChange, undefined);

  render() {
    const {onMerge} = this.props;
    const {mergeCount} = this.state;

    return (
      <PanelHeader hasButtons>
        <Confirm
          disabled={mergeCount === 0}
          message={t('Are you sure you want to merge these issues?')}
          onConfirm={onMerge}
        >
          <Button size="xs" title={t('Merging %s issues', mergeCount)}>
            {t('Merge %s', `(${mergeCount || 0})`)}
          </Button>
        </Confirm>

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
