import styled from 'react-emotion';
import {withTheme} from 'emotion-theming';

export default withTheme(
  styled.div`
    font-family: "Rubik", sans-serif;
    font-size: 16px;
    color: ${p => p.theme.gray5};
  `
);
