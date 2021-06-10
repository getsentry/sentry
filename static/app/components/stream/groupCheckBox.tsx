import {Component} from 'react';

import Checkbox from 'app/components/checkbox';
import {t} from 'app/locale';
import SelectedGroupStore from 'app/stores/selectedGroupStore';

type Props = {
  id: string;
  disabled: boolean;
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

  shouldComponentUpdate(_nextProps, nextState) {
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

  handleSelect = () => {
    const id = this.props.id;
    SelectedGroupStore.toggleSelect(id);
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
