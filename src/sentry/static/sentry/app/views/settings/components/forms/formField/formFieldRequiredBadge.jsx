import styled from 'react-emotion';

const FormFieldRequiredBadge = styled.div`
  display: inline-block;
  background: ${p => p.theme.gray2};
  width: 5px;
  height: 5px;
  border-radius: 5px;
  text-indent: -9999em;
  vertical-align: super;
`;

export default FormFieldRequiredBadge;
