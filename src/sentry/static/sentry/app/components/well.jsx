import styled from 'react-emotion';

export default styled('div')(props => {
  let styles = {
    border: `1px solid ${props.theme.borderLight}`,
    boxShadow: 'none',
    background: props.theme.whiteDark,
    padding: '15px 20px',
    marginBottom: '20px',
    borderRadius: '3px',
  };
  if (props.imagewell) {
    styles.padding = '80px 30px';
  }
  if (props.centered) {
    styles.textAlign = 'center';
  }

  return styles;
});
