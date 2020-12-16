import React from 'react';
import createReactClass from 'create-react-class';
import PropTypes from 'prop-types';
import Reflux from 'reflux';

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

const GroupCheckBox = createReactClass<Props, State>({
  displayName: 'GroupCheckBox',

  propTypes: {
    id: PropTypes.string.isRequired,
    disabled: PropTypes.bool,
  },

  mixins: [Reflux.listenTo(SelectedGroupStore, 'onSelectedGroupChange') as any],

  getInitialState() {
    return {
      isSelected: SelectedGroupStore.isSelected(this.props.id),
    };
  },

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.id !== this.props.id) {
      this.setState({
        isSelected: SelectedGroupStore.isSelected(nextProps.id),
      });
    }
  },

  shouldComponentUpdate(_nextProps, nextState) {
    return nextState.isSelected !== this.state.isSelected;
  },

  onSelectedGroupChange() {
    const isSelected = SelectedGroupStore.isSelected(this.props.id);
    if (isSelected !== this.state.isSelected) {
      this.setState({
        isSelected,
      });
    }
  },

  onSelect() {
    const id = this.props.id;
    SelectedGroupStore.toggleSelect(id);
  },

  render() {
    const {disabled, id} = this.props;
    const {isSelected} = this.state;

    return (
      <Checkbox
        aria-label={t('Select Issue')}
        value={id}
        checked={isSelected}
        onChange={this.onSelect}
        disabled={disabled}
      />
    );
  },
});

export default GroupCheckBox;
