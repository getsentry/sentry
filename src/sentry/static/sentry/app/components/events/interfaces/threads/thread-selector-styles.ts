import {Styles} from 'react-select';

const threadSelectoStyles: Styles = {
  control: provided => ({
    ...provided,
    width: '100%',
    height: 28,
    minHeight: 28,
    border: '1px solid #c1b8ca',
    borderColor: '#c1b8ca',
    boxShadow: '0 2px 0 rgba(0, 0, 0, 0.03)',
    cursor: 'pointer',
    maxWidth: 400,
    ':hover': {
      borderColor: '#c1b8ca',
    },
    '> :first-child': {
      paddingTop: 0,
      paddingBottom: 0,
    },
  }),
  container: provided => ({
    ...provided,
    zIndex: 3,
    position: 'relative',
    display: 'inline-flex',
    width: '100%',
    maxWidth: 350,
  }),
  valueContainer: base => ({
    ...base,
    maxHeight: '100%',
  }),
  indicatorsContainer: provided => ({
    ...provided,
    maxHeight: '100%',
  }),
  dropdownIndicator: (provided, state) => ({
    ...provided,
    transition: 'all .2s ease',
    transform: state.selectProps.menuIsOpen ? 'rotate(180deg)' : '',
  }),
  singleValue: (provided, state) => {
    let opacity = 1;
    if (state.isDisabled) {
      opacity = 0.5;
    }
    return {
      ...provided,
      opacity,
      transition: 'opacity 300ms',
      width: 'calc(100% - 10px)',
      color: '#443A4E',
    };
  },
  option: (provided, state) => {
    let background = '#ffffff';
    let color = '#443A4E';
    let opacity = 1;

    if (state.isSelected) {
      background = '#6c5fc7';
      color = '#ffffff';
    }
    if (state.isDisabled) {
      opacity = 0.5;
    }
    return {
      ...provided,
      fontSize: 15,
      cursor: !state.isDisabled ? 'pointer' : 'auto',
      background,
      color,
      opacity,
      transition: 'opacity 300ms',
      userSelect: state.isDisabled ? 'none' : 'auto',
      height: 'auto',
      marginLeft: -4,
      ':hover': {
        background: !state.isSelected && !state.isDisabled && '#f7f8f9',
      },
    };
  },
};

export default threadSelectoStyles;
