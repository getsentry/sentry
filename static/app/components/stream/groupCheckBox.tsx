import {Component} from 'react';

import Checkbox from 'sentry/components/checkbox';
import {t} from 'sentry/locale';
import SelectedGroupStore from 'sentry/stores/selectedGroupStore';

type Props = {
  disabled: boolean;
  id: string;
};

type State = {
  isSelected: boolean;
};

class GroupCheckBox extends Component<Props, State> {
  state: State = {
    isSelected: SelectedGroupStore.isSelected(this.props.id),
  };

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.id !== this.props.id) {
      this.setState({
        isSelected: SelectedGroupStore.isSelected(nextProps.id),
      });
    }
  }

  shouldComponentUpdate(_nextProps: Props, nextState: State) {
    return nextState.isSelected !== this.state.isSelected;
  }

  componentWillUnmount() {
    this.unsubscribe();
  }

  unsubscribe = SelectedGroupStore.listen(() => {
    this.onSelectedGroupChange();
  }, undefined);

  onSelectedGroupChange() {
    const isSelected = SelectedGroupStore.isSelected(this.props.id);
    if (isSelected !== this.state.isSelected) {
      this.setState({
        isSelected,
      });
    }
  }

  handleSelect = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const id = this.props.id;

    // Check for shift key while clicking
    if ((evt.nativeEvent as MouseEvent).shiftKey) {
      SelectedGroupStore.shiftToggleItems(id);
    } else {
      SelectedGroupStore.toggleSelect(id);
    }
  };

  render() {
    const {disabled, id} = this.props;
    const {isSelected} = this.state;

    return (
      <Checkbox
        aria-label={t('Select Issue')}
        value={id}
        checked={isSelected}
        onChange={this.handleSelect}
        disabled={disabled}
      />
    );
  }
}

export default GroupCheckBox;
