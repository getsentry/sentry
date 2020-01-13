// TODO(ts): Figure out why eslint chokes on this import
import styled, {CreateStyled} from '@original-emotion/styled'; // eslint-disable-line import/named
import theme from './utils/theme';

export default styled as CreateStyled<typeof theme>;
