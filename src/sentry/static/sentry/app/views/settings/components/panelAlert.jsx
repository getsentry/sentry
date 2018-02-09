import styled from 'react-emotion';

import Alert from '../../../components/alert';

const PanelAlert = styled(Alert)`
  margin: ${p =>
    `-${p.theme.grid * 2 + 1}px -${p.theme.grid * 2 + 1}px ${p.theme.grid * 3}px`};
  border-radius: 0;
`;

export default PanelAlert;
