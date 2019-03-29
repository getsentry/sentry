import React from 'react';
<<<<<<< HEAD
import styled from 'react-emotion';

=======

import styled from 'react-emotion';
>>>>>>> add in unlink issue stuffs
import InputField from './inputField';

export default class HiddenField extends React.Component {
  render() {
<<<<<<< HEAD
    return <HiddenInputField {...this.props} type="hidden" />;
  }
}

const HiddenInputField = styled(InputField)`
=======
    return <StyledInputField {...this.props} type="hidden" />;
  }
}

const StyledInputField = styled(InputField)`
>>>>>>> add in unlink issue stuffs
  display: none;
`;
